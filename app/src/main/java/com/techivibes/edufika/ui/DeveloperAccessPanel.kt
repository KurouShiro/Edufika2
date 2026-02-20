package com.techivibes.edufika.ui

import android.content.Context
import android.content.ClipData
import android.content.ClipboardManager
import android.os.Bundle
import android.view.View
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.widget.SwitchCompat
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
import com.techivibes.edufika.security.ScreenLock
import com.techivibes.edufika.utils.TestConstants
import com.techivibes.edufika.utils.TestUtils
import kotlinx.coroutines.launch
import java.util.UUID

class DeveloperAccessPanel : Fragment(R.layout.fragment_developer_access_panel) {

    private var unlocked = false

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val prefs = requireContext().getSharedPreferences(TestConstants.PREFS_NAME, Context.MODE_PRIVATE)
        val logger = SessionLogger(requireContext())

        val passwordInput = view.findViewById<EditText>(R.id.developerPasswordInput)
        val unlockButton = view.findViewById<MaterialButton>(R.id.unlockDeveloperButton)
        val kioskSwitch = view.findViewById<SwitchCompat>(R.id.kioskSwitch)
        val currentServerBaseUrlText = view.findViewById<TextView>(R.id.currentServerBaseUrlText)
        val serverBaseUrlInput = view.findViewById<EditText>(R.id.serverBaseUrlInput)
        val saveServerBaseUrlButton = view.findViewById<MaterialButton>(R.id.saveServerBaseUrlButton)
        val testServerConnectionButton = view.findViewById<MaterialButton>(R.id.testServerConnectionButton)
        val normalBrowserUrlInput = view.findViewById<EditText>(R.id.normalBrowserUrlInput)
        val openNormalBrowserButton = view.findViewById<MaterialButton>(R.id.openNormalBrowserButton)
        val adminTokenExpiryMinutesInput = view.findViewById<EditText>(R.id.adminTokenExpiryMinutesInput)
        val generateAdminTokenButton = view.findViewById<MaterialButton>(R.id.generateAdminTokenButton)
        val generatedAdminTokenText = view.findViewById<TextView>(R.id.generatedAdminTokenText)
        val copyAdminTokenButton = view.findViewById<MaterialButton>(R.id.copyAdminTokenButton)
        val developerLogoutButton = view.findViewById<MaterialButton>(R.id.developerLogoutButton)
        val forceDisableKioskButton = view.findViewById<MaterialButton>(R.id.forceDisableKioskButton)
        val sessionClient = SessionClient(requireContext())
        var latestAdminToken: String? = null

        unlocked = SessionState.currentRole == UserRole.DEVELOPER
        kioskSwitch.isChecked = prefs.getBoolean(TestConstants.PREF_APP_LOCK_ENABLED, true)
        serverBaseUrlInput.setText(sessionClient.getServerBaseUrl())
        adminTokenExpiryMinutesInput.setText(TestConstants.DEFAULT_TOKEN_EXPIRY_MINUTES.toString())

        fun refreshServerBaseUrlLabel() {
            currentServerBaseUrlText.text = "Backend API URL: ${sessionClient.getServerBaseUrl()}"
        }
        refreshServerBaseUrlLabel()

        fun applyState() {
            kioskSwitch.isEnabled = unlocked
            normalBrowserUrlInput.isEnabled = unlocked
            openNormalBrowserButton.isEnabled = unlocked
            adminTokenExpiryMinutesInput.isEnabled = unlocked
            generateAdminTokenButton.isEnabled = unlocked
            copyAdminTokenButton.isEnabled = unlocked
        }

        applyState()

        saveServerBaseUrlButton.setOnClickListener {
            val rawUrl = serverBaseUrlInput.text.toString().trim()
            if (rawUrl.isBlank()) {
                TestUtils.showToast(requireContext(), "Server URL tidak boleh kosong.")
                return@setOnClickListener
            }
            sessionClient.setServerBaseUrl(rawUrl)
            val normalized = sessionClient.getServerBaseUrl()
            serverBaseUrlInput.setText(normalized)
            refreshServerBaseUrlLabel()
            logger.append("DEVELOPER", "Backend API URL diubah ke $normalized")
            TestUtils.showToast(requireContext(), "Server API URL tersimpan.")
        }

        testServerConnectionButton.setOnClickListener {
            lifecycleScope.launch {
                val healthy = sessionClient.pingHealth()
                val currentUrl = sessionClient.getServerBaseUrl()
                if (healthy) {
                    logger.append("DEVELOPER", "Backend health check OK: $currentUrl")
                    TestUtils.showToast(requireContext(), "Backend online: $currentUrl")
                } else {
                    logger.append("DEVELOPER", "Backend health check FAILED: $currentUrl")
                    TestUtils.showToast(requireContext(), "Backend tidak terjangkau.")
                }
            }
        }

        unlockButton.setOnClickListener {
            val password = passwordInput.text.toString().trim()
            if (password != TestConstants.DEVELOPER_ACCESS_PASSWORD) {
                TestUtils.showToast(requireContext(), "Password developer salah.")
                return@setOnClickListener
            }

            lifecycleScope.launch {
                val claim = sessionClient.claimSession(password, roleHint = "developer")
                if (claim != null) {
                    SessionState.startSession(
                        token = password,
                        role = UserRole.DEVELOPER,
                        serverSessionId = claim.sessionId,
                        signature = claim.accessSignature,
                        bindingId = claim.deviceBindingId
                    )
                    logger.append("DEVELOPER", "Developer panel unlocked (server authorized).")
                } else {
                    // Debug fallback to prevent local lockout when backend is unavailable.
                    SessionState.startSession(
                        token = password,
                        role = UserRole.DEVELOPER
                    )
                    logger.append(
                        "DEVELOPER",
                        "Developer panel unlocked with local debug fallback."
                    )
                    TestUtils.showToast(
                        requireContext(),
                        "Server tidak tersedia. Unlock fallback debug aktif."
                    )
                }
                unlocked = true
                TestUtils.showToast(requireContext(), "Developer panel unlocked.")
                applyState()
            }
        }

        kioskSwitch.setOnCheckedChangeListener { _, isChecked ->
            if (!unlocked) {
                kioskSwitch.isChecked = !isChecked
                return@setOnCheckedChangeListener
            }
            prefs.edit().putBoolean(TestConstants.PREF_APP_LOCK_ENABLED, isChecked).apply()
            if (isChecked) {
                ScreenLock.apply(requireActivity())
            } else {
                ScreenLock.clear(requireActivity())
            }
            logger.append("DEVELOPER", "Kiosk mode set to $isChecked")
        }

        openNormalBrowserButton.setOnClickListener {
            if (!unlocked) {
                TestUtils.showToast(requireContext(), "Panel masih terkunci.")
                return@setOnClickListener
            }
            val url = TestUtils.normalizeUrl(normalBrowserUrlInput.text.toString())
            val targetUrl = if (url.isBlank()) "https://example.org" else url
            logger.append("DEVELOPER", "Buka browser mode normal: $targetUrl")
            FragmentNavigationTest.openExam(findNavController(), targetUrl, developerBypass = true)
        }

        generateAdminTokenButton.setOnClickListener {
            if (!unlocked) {
                TestUtils.showToast(requireContext(), "Panel masih terkunci.")
                return@setOnClickListener
            }
            lifecycleScope.launch {
                val expiryMinutes = adminTokenExpiryMinutesInput.text.toString()
                    .toIntOrNull()
                    ?.coerceIn(TestConstants.MIN_TOKEN_EXPIRY_MINUTES, TestConstants.MAX_TOKEN_EXPIRY_MINUTES)
                    ?: TestConstants.DEFAULT_TOKEN_EXPIRY_MINUTES

                val created = sessionClient.createSessionBundle(
                    proctorId = TestConstants.DEVELOPER_ACCESS_PASSWORD,
                    tokenTtlMinutes = expiryMinutes,
                    tokenCount = 1
                )
                val serverTokens = created?.tokens?.takeIf { it.isNotEmpty() } ?: listOfNotNull(created?.token)
                val serverAdminToken = serverTokens.firstOrNull { it.startsWith("A-") }

                val token = serverAdminToken ?: ("A-" + UUID.randomUUID().toString().replace("-", "").take(10).uppercase())
                val source = if (serverAdminToken != null) {
                    "developer-admin-generator-server"
                } else {
                    "developer-admin-generator-local-fallback"
                }
                val issued = TokenRegistry.issueToken(
                    context = requireContext(),
                    token = token,
                    role = UserRole.ADMIN,
                    expiryMinutes = expiryMinutes,
                    source = source
                )
                latestAdminToken = token
                generatedAdminTokenText.text = "Admin token: $token\nExpired at: ${TestUtils.timestampFromMillis(issued.expiresAtMillis)}"
                logger.append(
                    "DEVELOPER",
                    "Generated admin token ($source): $token | expiry=${issued.expiresAtMillis}"
                )

                if (serverAdminToken != null) {
                    TestUtils.showToast(requireContext(), "Admin token dibuat dari backend.")
                } else {
                    TestUtils.showToast(requireContext(), "Backend gagal. Admin token fallback lokal dibuat.")
                }
            }
        }

        copyAdminTokenButton.setOnClickListener {
            if (!unlocked) {
                TestUtils.showToast(requireContext(), "Panel masih terkunci.")
                return@setOnClickListener
            }
            val token = latestAdminToken
            if (token.isNullOrBlank()) {
                TestUtils.showToast(requireContext(), "Belum ada admin token.")
                return@setOnClickListener
            }
            val clipboard = requireContext().getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            clipboard.setPrimaryClip(ClipData.newPlainText("EdufikaAdminToken", token))
            TestUtils.showToast(requireContext(), "Admin token disalin.")
        }

        developerLogoutButton.setOnClickListener {
            logger.append("DEVELOPER", "Developer logout.")
            SessionState.clear()
            TestUtils.enableKiosk(requireContext(), activity = requireActivity())
            FragmentNavigationTest.goToLoginResetStack(findNavController())
        }

        forceDisableKioskButton.setOnClickListener {
            TestUtils.disableKioskForDebug(requireContext(), activity = requireActivity())
            kioskSwitch.isChecked = false
            logger.append("DEVELOPER", "Emergency kiosk disable executed.")
            TestUtils.showToast(requireContext(), "Kiosk dimatikan (emergency).")
        }
    }
}
