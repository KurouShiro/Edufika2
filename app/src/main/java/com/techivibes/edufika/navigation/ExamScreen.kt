package com.techivibes.edufika.navigation

import android.app.AlertDialog
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.google.android.material.button.MaterialButton
import com.techivibes.edufika.R
import com.techivibes.edufika.backend.SessionClient
import com.techivibes.edufika.data.SessionLogger
import com.techivibes.edufika.data.SessionState
import com.techivibes.edufika.data.UserRole
import com.techivibes.edufika.monitoring.HeartbeatService
import com.techivibes.edufika.security.ScreenOffReceiver
import com.techivibes.edufika.ui.UrlWhitelistStore
import com.techivibes.edufika.utils.TestConstants
import com.techivibes.edufika.utils.TestUtils
import kotlinx.coroutines.launch

class ExamScreen : Fragment(R.layout.fragment_exam_screen) {

    private var examWebView: WebView? = null
    private var watermarkText: TextView? = null
    private val watermarkHandler = Handler(Looper.getMainLooper())

    private val watermarkRunnable = object : Runnable {
        override fun run() {
            val token = SessionState.currentToken.ifBlank { "StudentID" }
            watermarkText?.text = "$token | ${TestUtils.timestampNow()}"
            watermarkHandler.postDelayed(this, 1000L)
        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val requestedUrl = arguments?.getString(TestConstants.ARG_EXAM_URL).orEmpty()
        val developerBypass = arguments?.getBoolean(TestConstants.ARG_DEVELOPER_BYPASS, false) ?: false
        val normalizedUrl = TestUtils.normalizeUrl(
            if (requestedUrl.isBlank()) {
                UrlWhitelistStore.getAll(requireContext()).firstOrNull().orEmpty()
            } else {
                requestedUrl
            }
        )

        val urlLabel = view.findViewById<TextView>(R.id.examUrlLabel)
        val exitButton = view.findViewById<MaterialButton>(R.id.exitExamButton)
        examWebView = view.findViewById(R.id.examWebView)
        watermarkText = view.findViewById(R.id.watermarkText)
        startWatermark()

        urlLabel.text = normalizedUrl

        lifecycleScope.launch {
            val allowed = developerBypass || UrlWhitelistStore.isWhitelistedServerAware(
                requireContext(),
                normalizedUrl
            )
            if (!allowed) {
                SessionState.registerRiskEvent(TestConstants.EVENT_REPEATED_VIOLATION)
                SessionLogger(requireContext()).append(
                    "BLOCK",
                    "ExamScreen: URL di luar whitelist diblokir: $normalizedUrl"
                )
                FragmentNavigationTest.openViolation(
                    findNavController(),
                    "ExamScreen: URL di luar whitelist diblokir."
                )
                return@launch
            }
            configureWebView(normalizedUrl, developerBypass, urlLabel)
        }

        exitButton.setOnClickListener {
            if (developerBypass ||
                SessionState.currentRole == UserRole.DEVELOPER ||
                SessionState.currentRole == UserRole.ADMIN
            ) {
                allowExit()
            } else {
                requestProctorPin()
            }
        }
    }

    private fun configureWebView(
        examUrl: String,
        developerBypass: Boolean,
        urlLabel: TextView
    ) {
        SessionState.setCurrentExamUrl(examUrl)
        val webView = examWebView ?: return
        val settings = webView.settings

        settings.javaScriptEnabled = true
        settings.allowFileAccess = false
        settings.allowFileAccessFromFileURLs = false
        settings.allowUniversalAccessFromFileURLs = false
        settings.setSupportMultipleWindows(false)
        settings.domStorageEnabled = true
        settings.builtInZoomControls = false
        settings.displayZoomControls = false

        webView.isLongClickable = false
        webView.setOnLongClickListener { true }
        webView.setHapticFeedbackEnabled(false)

        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                if (developerBypass) return false
                if (request?.isForMainFrame == false) return false
                val hasUserGesture = request?.hasGesture() == true

                val targetUrl = request?.url
                val target = targetUrl?.toString().orEmpty()
                if (target.isBlank()) return false

                val scheme = targetUrl?.scheme?.lowercase().orEmpty()
                if (scheme in setOf("about", "data", "javascript", "blob")) {
                    return false
                }
                if (scheme != "http" && scheme != "https") {
                    handleBlockedNavigation(
                        hasUserGesture = hasUserGesture,
                        detail = "Navigasi non-web diblokir: $target",
                        view = view
                    )
                    return true
                }

                val normalizedTarget = TestUtils.normalizeUrl(target)
                if (normalizedTarget.isBlank()) return false

                if (!UrlWhitelistStore.isWhitelisted(requireContext(), normalizedTarget)) {
                    validateWhitelistWithServer(
                        targetUrl = normalizedTarget,
                        onAllowed = {
                            UrlWhitelistStore.add(requireContext(), normalizedTarget)
                        },
                        onDenied = {
                            handleBlockedNavigation(
                                hasUserGesture = hasUserGesture,
                                detail = "Navigasi keluar domain whitelist: $normalizedTarget",
                                view = view
                            )
                        },
                        onUnavailable = {
                            SessionLogger(requireContext()).append(
                                "WHITELIST",
                                "Server whitelist tidak terjangkau, fallback sementara: $normalizedTarget"
                            )
                        }
                    )
                    return false
                }

                validateWhitelistWithServer(
                    targetUrl = normalizedTarget,
                    onAllowed = {
                        UrlWhitelistStore.add(requireContext(), normalizedTarget)
                    },
                    onDenied = {
                        handleBlockedNavigation(
                            hasUserGesture = hasUserGesture,
                            detail = "Server reject URL: $normalizedTarget",
                            view = view
                        )
                    },
                    onUnavailable = {
                        SessionLogger(requireContext()).append(
                            "WHITELIST",
                            "Verifikasi server gagal sementara, lanjut dengan cache lokal: $normalizedTarget"
                        )
                    }
                )

                return false
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                urlLabel.text = url.orEmpty()
            }

            override fun onReceivedHttpError(
                view: WebView?,
                request: WebResourceRequest?,
                errorResponse: WebResourceResponse?
            ) {
                super.onReceivedHttpError(view, request, errorResponse)
                val statusCode = errorResponse?.statusCode ?: 0
                SessionLogger(requireContext()).append(
                    "WEBVIEW",
                    "HTTP error saat membuka ${request?.url?.toString().orEmpty()} (status=$statusCode)"
                )
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: android.webkit.WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    val description = error?.description?.toString().orEmpty()
                    SessionLogger(requireContext()).append(
                        "WEBVIEW",
                        "Gagal memuat halaman utama: $description"
                    )
                    TestUtils.showToast(requireContext(), "Gagal memuat halaman ujian.")
                }
            }
        }

        webView.loadUrl(examUrl)
    }

    private fun reportWhitelistViolation(detail: String) {
        SessionState.registerRiskEvent(TestConstants.EVENT_REPEATED_VIOLATION)
        SessionLogger(requireContext()).append("BLOCK", detail)
        FragmentNavigationTest.openViolation(findNavController(), detail)
    }

    private fun handleBlockedNavigation(
        hasUserGesture: Boolean,
        detail: String,
        view: WebView?
    ) {
        view?.stopLoading()
        if (hasUserGesture) {
            reportWhitelistViolation(detail)
        } else {
            SessionLogger(requireContext()).append("BLOCK_AUTO_REDIRECT", detail)
        }
    }

    private fun validateWhitelistWithServer(
        targetUrl: String,
        onAllowed: () -> Unit,
        onDenied: () -> Unit,
        onUnavailable: () -> Unit
    ) {
        lifecycleScope.launch {
            val client = SessionClient(requireContext())
            val serverDecision = client.verifyWhitelistUrl(targetUrl)
            when (serverDecision) {
                true -> onAllowed()
                false -> onDenied()
                null -> {
                    val backendOnline = client.pingHealth()
                    if (backendOnline) {
                        onDenied()
                    } else {
                        onUnavailable()
                    }
                }
            }
        }
    }

    private fun requestProctorPin() {
        val pinInput = EditText(requireContext())
        pinInput.hint = getString(R.string.pin_hint)
        pinInput.inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD

        AlertDialog.Builder(requireContext())
            .setTitle(getString(R.string.pin_prompt))
            .setView(pinInput)
            .setPositiveButton(getString(R.string.submit)) { _, _ ->
                val enteredPin = pinInput.text.toString().trim()
                lifecycleScope.launch {
                    val result = SessionClient(requireContext()).verifyProctorPin(enteredPin)
                    when {
                        result?.valid == true -> allowExit()
                        result?.reason == "PIN_EXPIRED" -> {
                            SessionLogger(requireContext()).append(
                                "PIN",
                                "PIN proktor kadaluarsa untuk sesi hari ini."
                            )
                            TestUtils.showToast(requireContext(), "PIN proktor harus diperbarui hari ini.")
                        }
                        result?.reason == "PIN_NOT_SET" -> {
                            SessionLogger(requireContext()).append(
                                "PIN",
                                "PIN proktor belum diset di server."
                            )
                            TestUtils.showToast(requireContext(), "PIN proktor belum dikonfigurasi.")
                        }
                        else -> {
                            SessionLogger(requireContext()).append(
                                "PIN",
                                "Percobaan PIN proktor tidak valid."
                            )
                            TestUtils.showToast(requireContext(), "PIN proktor tidak valid.")
                        }
                    }
                }
            }
            .setNegativeButton(getString(R.string.cancel), null)
            .show()
    }

    private fun allowExit() {
        val sessionId = SessionState.sessionId
        val accessSignature = SessionState.accessSignature

        HeartbeatService.stop(requireContext())
        ScreenOffReceiver.stopAlarm()
        lifecycleScope.launch {
            SessionClient(requireContext()).finishSession(sessionId, accessSignature)
        }
        SessionLogger(requireContext()).append("EXAM", "Sesi ujian ditutup oleh proktor/developer.")
        SessionState.clear()
        TestUtils.enableKiosk(requireContext(), activity = requireActivity())
        FragmentNavigationTest.goToLoginResetStack(findNavController())
    }

    private fun startWatermark() {
        watermarkHandler.removeCallbacks(watermarkRunnable)
        watermarkHandler.post(watermarkRunnable)
    }

    override fun onDestroyView() {
        watermarkHandler.removeCallbacks(watermarkRunnable)
        examWebView?.destroy()
        examWebView = null
        watermarkText = null
        super.onDestroyView()
    }
}
