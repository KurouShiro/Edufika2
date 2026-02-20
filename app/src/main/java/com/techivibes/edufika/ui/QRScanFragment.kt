package com.techivibes.edufika.ui

import android.os.Bundle
import android.view.View
import android.widget.EditText
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import com.google.android.material.button.MaterialButton
import com.techivibes.edufika.R
import com.techivibes.edufika.data.SessionLogger
import com.techivibes.edufika.data.SessionState
import com.techivibes.edufika.navigation.FragmentNavigationTest
import com.techivibes.edufika.utils.TestConstants
import com.techivibes.edufika.utils.TestUtils
import kotlinx.coroutines.launch
import android.content.pm.PackageManager

class QRScanFragment : Fragment(R.layout.fragment_qr_scan) {

    private lateinit var qrMockInput: EditText
    private val cameraPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) {
                launchQrCamera()
            } else {
                MaterialAlertDialogBuilder(requireContext())
                    .setTitle("Akses kamera dibutuhkan")
                    .setMessage("Izinkan kamera agar fitur scan QR dapat berjalan.")
                    .setPositiveButton("OK", null)
                    .show()
            }
        }
    private val qrScanLauncher = registerForActivityResult(ScanContract()) { result ->
        val content = result.contents?.trim().orEmpty()
        if (content.isBlank()) {
            return@registerForActivityResult
        }
        qrMockInput.setText(content)
        processScannedUrl(content)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        qrMockInput = view.findViewById(R.id.qrMockInput)
        val useValueButton = view.findViewById<MaterialButton>(R.id.qrUseValueButton)
        val startCameraButton = view.findViewById<MaterialButton>(R.id.qrStartCameraButton)
        val backButton = view.findViewById<MaterialButton>(R.id.qrBackButton)

        startCameraButton.setOnClickListener {
            if (ContextCompat.checkSelfPermission(
                    requireContext(),
                    android.Manifest.permission.CAMERA
                ) == PackageManager.PERMISSION_GRANTED
            ) {
                launchQrCamera()
            } else {
                cameraPermissionLauncher.launch(android.Manifest.permission.CAMERA)
            }
        }

        useValueButton.setOnClickListener {
            processScannedUrl(qrMockInput.text.toString())
        }

        backButton.setOnClickListener {
            findNavController().navigate(R.id.examFlowTest)
        }
    }

    private fun launchQrCamera() {
        val options = ScanOptions()
            .setDesiredBarcodeFormats(ScanOptions.QR_CODE)
            .setPrompt("Arahkan kamera ke QR ujian")
            .setBeepEnabled(true)
            .setOrientationLocked(true)
        qrScanLauncher.launch(options)
    }

    private fun processScannedUrl(rawValue: String) {
        val scannedUrl = TestUtils.extractExamUrl(rawValue)
        if (scannedUrl.isBlank()) {
            TestUtils.showToast(requireContext(), "Hasil QR tidak berisi URL ujian.")
            return
        }

        SessionLogger(requireContext()).append("QR", "Payload QR diterima: $rawValue")
        lifecycleScope.launch {
            val allowed = UrlWhitelistStore.isWhitelistedServerAware(requireContext(), scannedUrl)
            if (!allowed) {
                SessionState.registerRiskEvent(TestConstants.EVENT_REPEATED_VIOLATION)
                TestUtils.showToast(requireContext(), "Hasil scan tidak ada di whitelist.")
                runCatching {
                    FragmentNavigationTest.openViolation(
                        findNavController(),
                        "QR mengarah ke URL di luar whitelist."
                    )
                }
                return@launch
            }
            SessionLogger(requireContext()).append("QR", "URL dari QR dipakai: $scannedUrl")
            runCatching {
                FragmentNavigationTest.openExam(findNavController(), scannedUrl)
            }.onFailure {
                SessionLogger(requireContext()).append(
                    "QR",
                    "Gagal membuka browser ujian dari QR: ${it.message.orEmpty()}"
                )
                TestUtils.showToast(requireContext(), "Gagal membuka browser ujian.")
            }
        }
    }
}
