package com.techivibes.edufika.rn

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import com.techivibes.edufika.R
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class CameraXQrScannerActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_QR_VALUE = "extra_qr_value"
    }

    private lateinit var previewView: PreviewView
    private lateinit var statusText: TextView
    private lateinit var closeButton: Button
    private lateinit var cameraExecutor: ExecutorService
    @Volatile
    private var scanCompleted = false

    private val barcodeScanner by lazy {
        val options = BarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
            .build()
        BarcodeScanning.getClient(options)
    }

    private val cameraPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) {
                startCamera()
            } else {
                finishCancelled()
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_camerax_qr_scanner)

        previewView = findViewById(R.id.qrPreviewView)
        statusText = findViewById(R.id.qrScannerStatusText)
        closeButton = findViewById(R.id.qrScannerCloseButton)
        cameraExecutor = Executors.newSingleThreadExecutor()

        closeButton.setOnClickListener {
            finishCancelled()
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) ==
            PackageManager.PERMISSION_GRANTED
        ) {
            startCamera()
        } else {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    private fun startCamera() {
        statusText.text = getString(R.string.qr_scanner_status_starting)
        val providerFuture = ProcessCameraProvider.getInstance(this)
        providerFuture.addListener(
            {
                val provider = runCatching { providerFuture.get() }.getOrNull() ?: run {
                    finishCancelled()
                    return@addListener
                }

                val preview = Preview.Builder().build().also { cameraPreview ->
                    cameraPreview.surfaceProvider = previewView.surfaceProvider
                }

                val analysis = ImageAnalysis.Builder()
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .build()

                analysis.setAnalyzer(cameraExecutor) { imageProxy ->
                    if (scanCompleted) {
                        imageProxy.close()
                        return@setAnalyzer
                    }

                    val mediaImage = imageProxy.image
                    if (mediaImage == null) {
                        imageProxy.close()
                        return@setAnalyzer
                    }

                    val inputImage = InputImage.fromMediaImage(
                        mediaImage,
                        imageProxy.imageInfo.rotationDegrees
                    )

                    barcodeScanner.process(inputImage)
                        .addOnSuccessListener { barcodes ->
                            if (scanCompleted) {
                                return@addOnSuccessListener
                            }
                            val value = barcodes
                                .firstOrNull { !it.rawValue.isNullOrBlank() }
                                ?.rawValue
                                ?.trim()
                                .orEmpty()
                            if (value.isBlank()) {
                                return@addOnSuccessListener
                            }
                            scanCompleted = true
                            runOnUiThread {
                                val data = Intent().putExtra(EXTRA_QR_VALUE, value)
                                setResult(Activity.RESULT_OK, data)
                                finish()
                            }
                        }
                        .addOnCompleteListener {
                            imageProxy.close()
                        }
                }

                runCatching {
                    provider.unbindAll()
                    provider.bindToLifecycle(
                        this,
                        CameraSelector.DEFAULT_BACK_CAMERA,
                        preview,
                        analysis
                    )
                    statusText.text = getString(R.string.qr_scanner_status_ready)
                }.onFailure {
                    finishCancelled()
                }
            },
            ContextCompat.getMainExecutor(this)
        )
    }

    private fun finishCancelled() {
        if (scanCompleted) {
            return
        }
        scanCompleted = true
        setResult(Activity.RESULT_CANCELED)
        finish()
    }

    override fun onDestroy() {
        runCatching { barcodeScanner.close() }
        runCatching { cameraExecutor.shutdown() }
        super.onDestroy()
    }
}
