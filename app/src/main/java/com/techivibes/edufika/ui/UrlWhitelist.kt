package com.techivibes.edufika.ui

import android.content.Context
import android.net.Uri
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
import com.techivibes.edufika.utils.TestConstants
import com.techivibes.edufika.utils.TestUtils
import kotlinx.coroutines.launch

class UrlWhitelist : Fragment(R.layout.fragment_url_whitelist) {

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val whitelistInput = view.findViewById<EditText>(R.id.whitelistInput)
        val addButton = view.findViewById<MaterialButton>(R.id.addWhitelistButton)
        val currentWhitelistText = view.findViewById<TextView>(R.id.currentWhitelistText)
        val proctorPinInput = view.findViewById<EditText>(R.id.proctorPinInput)
        val proctorPinStatusText = view.findViewById<TextView>(R.id.proctorPinStatusText)
        val savePinButton = view.findViewById<MaterialButton>(R.id.savePinButton)
        val backButton = view.findViewById<MaterialButton>(R.id.backAdminButton)
        val sessionClient = SessionClient(requireContext())

        fun refreshWhitelist() {
            lifecycleScope.launch {
                val ready = sessionClient.ensureAdminControlSession()
                val serverList = if (ready) sessionClient.fetchWhitelist() else null
                if (serverList != null) {
                    UrlWhitelistStore.replaceAll(requireContext(), serverList.toSet())
                } else {
                    SessionLogger(requireContext()).append(
                        "WHITELIST",
                        "Gagal memuat whitelist dari server."
                    )
                }
                currentWhitelistText.text = UrlWhitelistStore.getAll(requireContext())
                    .joinToString(separator = "\n")
            }
        }

        fun refreshProctorPinStatus() {
            lifecycleScope.launch {
                val ready = sessionClient.ensureAdminControlSession()
                val status = if (ready) sessionClient.getProctorPinStatus() else null
                proctorPinStatusText.text = when {
                    status == null -> "PIN status (student token): server unavailable"
                    !status.configured -> "PIN status (student token): belum diset"
                    status.isActiveToday -> "PIN status (student token): aktif hari ini (${status.effectiveDate})"
                    else -> "PIN status (student token): expired (${status.effectiveDate})"
                }
            }
        }

        refreshWhitelist()
        refreshProctorPinStatus()

        addButton.setOnClickListener {
            val normalized = TestUtils.normalizeUrl(whitelistInput.text.toString())
            if (normalized.isBlank()) {
                TestUtils.showToast(requireContext(), "URL tidak boleh kosong.")
                return@setOnClickListener
            }
            lifecycleScope.launch {
                val sessionReady = sessionClient.ensureAdminControlSession()
                if (!sessionReady) {
                    SessionLogger(requireContext()).append(
                        "WHITELIST",
                        "Session kontrol admin backend tidak tersedia saat menambah URL."
                    )
                    TestUtils.showToast(requireContext(), "Session admin backend tidak valid.")
                    return@launch
                }

                var serverSaved = sessionClient.addWhitelistUrl(normalized)
                if (!serverSaved) {
                    val recovered = sessionClient.ensureAdminControlSession()
                    if (recovered) {
                        serverSaved = sessionClient.addWhitelistUrl(normalized)
                    }
                }
                if (serverSaved) {
                    SessionLogger(requireContext()).append(
                        "WHITELIST",
                        "URL ditambahkan (server): $normalized"
                    )
                    whitelistInput.setText("")
                    refreshWhitelist()
                } else {
                    val healthy = sessionClient.pingHealth()
                    SessionLogger(requireContext()).append(
                        "WHITELIST",
                        "URL gagal ditambahkan ke server: $normalized"
                    )
                    val message = if (healthy) {
                        "Session admin backend invalid. Buka ulang Admin Panel."
                    } else {
                        "Server whitelist tidak terjangkau."
                    }
                    TestUtils.showToast(requireContext(), message)
                }
            }
        }

        savePinButton.setOnClickListener {
            val pin = proctorPinInput.text.toString().trim()
            if (pin.length < 4) {
                TestUtils.showToast(requireContext(), "PIN minimal 4 digit.")
                return@setOnClickListener
            }
            lifecycleScope.launch {
                val sessionReady = sessionClient.ensureAdminControlSession()
                if (!sessionReady) {
                    SessionLogger(requireContext()).append("PIN", "Session kontrol admin backend tidak tersedia.")
                    TestUtils.showToast(requireContext(), "Session admin backend tidak valid.")
                    return@launch
                }
                val result = sessionClient.setProctorPin(pin)
                if (result != null && result.configured) {
                    val prefs = requireContext().getSharedPreferences(TestConstants.PREFS_NAME, Context.MODE_PRIVATE)
                    prefs.edit().putString(TestConstants.PREF_PROCTOR_PIN, pin).apply()
                    SessionLogger(requireContext()).append("PIN", "PIN proktor diperbarui di server (${result.effectiveDate}).")
                    proctorPinInput.setText("")
                    refreshProctorPinStatus()
                    TestUtils.showToast(requireContext(), "PIN siswa disimpan di server (per token sesi).")
                } else {
                    SessionLogger(requireContext()).append("PIN", "Gagal menyimpan PIN proktor ke server.")
                    TestUtils.showToast(requireContext(), "Gagal menyimpan PIN ke server.")
                }
            }
        }

        backButton.setOnClickListener {
            findNavController().navigate(R.id.adminPanelTest)
        }
    }
}

object UrlWhitelistStore {

    fun getAll(context: Context): Set<String> {
        val prefs = context.getSharedPreferences(TestConstants.PREFS_NAME, Context.MODE_PRIVATE)
        val stored = prefs.getStringSet(TestConstants.PREF_URL_WHITELIST, null)
        return stored?.toSet().orEmpty()
    }

    fun add(context: Context, url: String) {
        val current = getAll(context).toMutableSet()
        current.add(url)
        context.getSharedPreferences(TestConstants.PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putStringSet(TestConstants.PREF_URL_WHITELIST, current)
            .apply()
    }

    fun replaceAll(context: Context, urls: Set<String>) {
        context.getSharedPreferences(TestConstants.PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putStringSet(TestConstants.PREF_URL_WHITELIST, urls)
            .apply()
    }

    fun isWhitelisted(context: Context, url: String): Boolean {
        val normalizedTarget = TestUtils.normalizeUrl(url)
        val targetUri = Uri.parse(normalizedTarget)
        val targetHost = targetUri.host?.lowercase().orEmpty()
        if (targetHost.isBlank()) return false

        return getAll(context).any { allowed ->
            val allowedUri = Uri.parse(TestUtils.normalizeUrl(allowed))
            val allowedHost = allowedUri.host?.lowercase().orEmpty()
            val sameHost = targetHost == allowedHost
            val samePrefix = normalizedTarget.startsWith(TestUtils.normalizeUrl(allowed))
            val sameTrustedFamily = isSameTrustedHostFamily(targetHost, allowedHost)
            sameHost || samePrefix || sameTrustedFamily
        }
    }

    suspend fun isWhitelistedServerAware(context: Context, url: String): Boolean {
        val sessionClient = SessionClient(context)
        val serverResult = sessionClient.verifyWhitelistUrl(url)
        if (SessionState.sessionId.isNotBlank() && SessionState.accessSignature.isNotBlank()) {
            return serverResult ?: false
        }
        return serverResult ?: isWhitelisted(context, url)
    }

    private fun isSameTrustedHostFamily(targetHost: String, allowedHost: String): Boolean {
        val target = targetHost.lowercase()
        val allowed = allowedHost.lowercase()
        val allowedGoogleFamily = allowed == "google.com" ||
            allowed == "www.google.com" ||
            allowed.endsWith(".google.com") ||
            allowed == "forms.gle"
        if (!allowedGoogleFamily) return false

        return target == "google.com" ||
            target == "www.google.com" ||
            target.endsWith(".google.com") ||
            target == "forms.gle"
    }
}
