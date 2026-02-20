package com.techivibes.edufika.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.view.View
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
import com.techivibes.edufika.data.TokenRegistry
import com.techivibes.edufika.data.UserRole
import com.techivibes.edufika.navigation.FragmentNavigationTest
import com.techivibes.edufika.utils.TestConstants
import com.techivibes.edufika.utils.TestUtils
import kotlinx.coroutines.launch
import java.util.UUID

class AdminPanelTest : Fragment(R.layout.fragment_admin_panel_test) {

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val logger = SessionLogger(requireContext())
        val launchUrlInput = view.findViewById<EditText>(R.id.launchUrlInput)
        val tokenExpiryMinutesInput = view.findViewById<EditText>(R.id.tokenExpiryMinutesInput)
        val generatedTokenText = view.findViewById<TextView>(R.id.generatedTokenText)
        val loggerFilePathText = view.findViewById<TextView>(R.id.loggerFilePathText)
        val logsText = view.findViewById<TextView>(R.id.logsText)
        val generateTokenButton = view.findViewById<MaterialButton>(R.id.generateTokenButton)
        val copyGeneratedTokenButton = view.findViewById<MaterialButton>(R.id.copyGeneratedTokenButton)
        val openWhitelistButton = view.findViewById<MaterialButton>(R.id.openWhitelistButton)
        val adminLogoutButton = view.findViewById<MaterialButton>(R.id.adminLogoutButton)
        val sessionClient = SessionClient(requireContext())
        var latestGeneratedToken: String? = null

        fun refreshLogs() {
            logsText.text = logger.getAll().joinToString(separator = "\n")
        }

        refreshLogs()
        tokenExpiryMinutesInput.setText(TestConstants.DEFAULT_TOKEN_EXPIRY_MINUTES.toString())
        loggerFilePathText.text = "Logger file: ${logger.getLogFilePath()}"

        generateTokenButton.setOnClickListener {
            lifecycleScope.launch {
                val launchUrl = TestUtils.normalizeUrl(launchUrlInput.text.toString()).ifBlank { null }
                val expiryMinutes = tokenExpiryMinutesInput.text.toString()
                    .toIntOrNull()
                    ?.coerceIn(TestConstants.MIN_TOKEN_EXPIRY_MINUTES, TestConstants.MAX_TOKEN_EXPIRY_MINUTES)
                    ?: TestConstants.DEFAULT_TOKEN_EXPIRY_MINUTES
                val created = sessionClient.createSessionBundle(
                    proctorId = "AdminID",
                    launchUrl = launchUrl,
                    tokenTtlMinutes = expiryMinutes,
                    tokenCount = 2
                )
                val serverTokens = created?.tokens?.takeIf { it.isNotEmpty() } ?: listOfNotNull(created?.token)
                val studentToken = serverTokens.firstOrNull { it.startsWith("S-") } ?: serverTokens.firstOrNull()
                val adminControlToken = serverTokens.firstOrNull { it.startsWith("A-") }
                val controlClaim = adminControlToken?.let { token ->
                    sessionClient.claimSession(token, roleHint = "admin")
                }

                if (controlClaim != null) {
                    SessionState.startSession(
                        token = "AdminID",
                        role = UserRole.ADMIN,
                        sessionExpiresAtMillis = controlClaim.tokenExpiresAtMillis,
                        serverSessionId = controlClaim.sessionId,
                        signature = controlClaim.accessSignature,
                        bindingId = controlClaim.deviceBindingId
                    )
                    if (controlClaim.whitelist.isNotEmpty()) {
                        UrlWhitelistStore.replaceAll(requireContext(), controlClaim.whitelist.toSet())
                    }
                }

                val token = studentToken ?: ("S-" + UUID.randomUUID().toString().take(8).uppercase())
                val source = when {
                    created == null -> "fallback-local"
                    controlClaim == null -> "server-without-control-session"
                    else -> "server+control-session"
                }
                val issued = TokenRegistry.issueToken(
                    context = requireContext(),
                    token = token,
                    role = UserRole.STUDENT,
                    expiryMinutes = expiryMinutes,
                    source = source
                )
                latestGeneratedToken = token
                generatedTokenText.text = buildString {
                    append("Token siswa baru: $token\n")
                    append("Expired at: ${TestUtils.timestampFromMillis(issued.expiresAtMillis)}\n")
                    append("Launch URL: ${launchUrl ?: "(tidak diset)"}")
                }
                logger.append(
                    "TOKEN",
                    "Admin membuat session token ($source): $token | expiry=${issued.expiresAtMillis} | launch_url=${launchUrl ?: "none"}"
                )
                if (controlClaim == null && created != null) {
                    TestUtils.showToast(requireContext(), "Session admin backend belum aktif. Whitelist/PIN bisa gagal.")
                }
                refreshLogs()
            }
        }

        copyGeneratedTokenButton.setOnClickListener {
            val token = latestGeneratedToken
            if (token.isNullOrBlank()) {
                TestUtils.showToast(requireContext(), "Belum ada token untuk dicopy.")
                return@setOnClickListener
            }
            val clipboard = requireContext().getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            clipboard.setPrimaryClip(ClipData.newPlainText("EdufikaToken", token))
            TestUtils.showToast(requireContext(), "Token disalin ke clipboard.")
        }

        openWhitelistButton.setOnClickListener {
            lifecycleScope.launch {
                val ready = sessionClient.ensureAdminControlSession()
                if (!ready) {
                    TestUtils.showToast(
                        requireContext(),
                        "Session admin backend gagal dibuat."
                    )
                    return@launch
                }

                val serverList = sessionClient.fetchWhitelist()
                if (serverList != null) {
                    UrlWhitelistStore.replaceAll(requireContext(), serverList.toSet())
                }
                logger.append("ADMIN", "Session kontrol backend aktif untuk whitelist/PIN.")

                findNavController().navigate(R.id.urlWhitelist)
            }
        }

        adminLogoutButton.setOnClickListener {
            logger.append("LOGOUT", "Admin logout.")
            SessionState.clear()
            FragmentNavigationTest.goToLoginResetStack(findNavController())
        }
    }
}
