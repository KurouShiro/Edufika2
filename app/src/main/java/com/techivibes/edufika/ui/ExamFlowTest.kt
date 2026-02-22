package com.techivibes.edufika.ui

import android.os.Bundle
import android.view.View
import android.widget.EditText
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.google.android.material.button.MaterialButton
import com.techivibes.edufika.R
import com.techivibes.edufika.backend.SessionClient
import com.techivibes.edufika.data.SessionLogger
import com.techivibes.edufika.data.SessionState
import com.techivibes.edufika.monitoring.PreExamChecks
import com.techivibes.edufika.navigation.FragmentNavigationTest
import com.techivibes.edufika.utils.TestConstants
import com.techivibes.edufika.utils.TestUtils
import kotlinx.coroutines.launch

class ExamFlowTest : Fragment(R.layout.fragment_exam_flow_test) {

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val examUrlInput = view.findViewById<EditText>(R.id.examUrlInput)
        val startExamButton = view.findViewById<MaterialButton>(R.id.startExamButton)
        val scanQrButton = view.findViewById<MaterialButton>(R.id.scanQrButton)
        val logoutButton = view.findViewById<MaterialButton>(R.id.logoutButton)
        val sessionClient = SessionClient(requireContext())

        startExamButton.setOnClickListener {
            val manualUrl = TestUtils.extractExamUrl(examUrlInput.text.toString())

            lifecycleScope.launch {
                val readiness = PreExamChecks.evaluate(requireContext())
                if (readiness.isBlocking) {
                    SessionLogger(requireContext()).append("PRECHECK", readiness.message)
                    TestUtils.showToast(requireContext(), readiness.message)
                    return@launch
                }
                if (readiness.message != "Pre-check OK") {
                    SessionLogger(requireContext()).append("PRECHECK", readiness.message)
                }

                val pingStart = System.currentTimeMillis()
                val backendHealthy = sessionClient.pingHealth()
                val pingLatency = System.currentTimeMillis() - pingStart
                if (!backendHealthy) {
                    SessionLogger(requireContext()).append("PRECHECK", "Backend tidak terjangkau saat pre-check.")
                    TestUtils.showToast(requireContext(), "Backend tidak terjangkau.")
                    return@launch
                }
                if (pingLatency > 3000L) {
                    SessionLogger(requireContext()).append(
                        "PRECHECK",
                        "Latensi backend tinggi (${pingLatency}ms), lanjut dengan monitoring ketat."
                    )
                }

                val serverWhitelist = sessionClient.fetchWhitelist()
                if (serverWhitelist == null) {
                    TestUtils.showToast(requireContext(), "Whitelist server tidak terjangkau.")
                    SessionLogger(requireContext()).append(
                        "EXAM",
                        "Gagal memuat whitelist dari server sebelum memulai ujian."
                    )
                    return@launch
                }
                UrlWhitelistStore.replaceAll(requireContext(), serverWhitelist.toSet())

                val launchConfig = if (manualUrl.isBlank()) {
                    sessionClient.fetchLaunchConfig()
                } else {
                    null
                }

                val source = when {
                    manualUrl.isNotBlank() -> "manual"
                    !launchConfig?.launchUrl.isNullOrBlank() -> "server-launch"
                    else -> "local-whitelist-fallback"
                }

                val targetUrl = when {
                    manualUrl.isNotBlank() -> manualUrl
                    !launchConfig?.launchUrl.isNullOrBlank() -> launchConfig?.launchUrl.orEmpty()
                    else -> serverWhitelist.firstOrNull().orEmpty()
                }

                if (targetUrl.isBlank()) {
                    TestUtils.showToast(requireContext(), "URL ujian belum diset oleh proktor.")
                    return@launch
                }

                val allowed = UrlWhitelistStore.isWhitelistedServerAware(requireContext(), targetUrl)
                if (!allowed) {
                    SessionState.registerRiskEvent(TestConstants.EVENT_REPEATED_VIOLATION)
                    TestUtils.showToast(requireContext(), "URL tidak termasuk whitelist.")
                    FragmentNavigationTest.openViolation(
                        findNavController(),
                        "URL tidak terdaftar dalam whitelist ujian."
                    )
                    return@launch
                }

                SessionLogger(requireContext()).append(
                    "EXAM",
                    "Siswa membuka URL ujian ($source): $targetUrl"
                )
                SessionState.setCurrentExamUrl(targetUrl)
                FragmentNavigationTest.openExam(findNavController(), targetUrl)
            }
        }

        scanQrButton.setOnClickListener {
            findNavController().navigate(R.id.qrScanFragment)
        }

        logoutButton.setOnClickListener {
            SessionLogger(requireContext()).append("LOGOUT", "Siswa keluar dari sesi.")
            SessionState.clear()
            TestUtils.shutdownApp(requireActivity(), disableKioskForCurrentRun = true)
        }
    }
}
