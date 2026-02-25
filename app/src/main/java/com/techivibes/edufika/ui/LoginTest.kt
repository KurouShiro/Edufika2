package com.techivibes.edufika.ui

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.EditText
import android.widget.TextView
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.navigation.fragment.findNavController
import com.google.android.material.button.MaterialButton
import com.techivibes.edufika.BuildConfig
import com.techivibes.edufika.R
import com.techivibes.edufika.ReactNativeHostActivity
import com.techivibes.edufika.data.SessionLogger
import com.techivibes.edufika.data.UserRole
import com.techivibes.edufika.security.ScreenLock
import com.techivibes.edufika.utils.TestConstants
import com.techivibes.edufika.utils.TestUtils
import com.techivibes.edufika.viewmodel.SessionViewModel

class LoginTest : Fragment(R.layout.fragment_login_test) {

    private val sessionViewModel: SessionViewModel by activityViewModels()

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val tokenInput = view.findViewById<EditText>(R.id.tokenInput)
        val loginButton = view.findViewById<MaterialButton>(R.id.loginButton)
        val loginMessage = view.findViewById<TextView>(R.id.loginMessage)
        val debugTokensLabel = view.findViewById<TextView>(R.id.debugTokensLabel)
        val debugButtonsRow = view.findViewById<View>(R.id.debugButtonsRow)
        val debugStudentButton = view.findViewById<MaterialButton>(R.id.debugStudentButton)
        val debugAdminButton = view.findViewById<MaterialButton>(R.id.debugAdminButton)
        val debugDeveloperButton = view.findViewById<MaterialButton>(R.id.debugDeveloperButton)
        val emergencyKioskOffButton = view.findViewById<MaterialButton>(R.id.emergencyKioskOffButton)
        val openRnUiButton = view.findViewById<MaterialButton>(R.id.openRnUiButton)
        val exitAppButton = view.findViewById<MaterialButton>(R.id.exitAppButton)
        val loginTitleText = view.findViewById<TextView>(R.id.loginTitleText)
        val devToolsEnabled = BuildConfig.DEV_TOOLS_ENABLED
        sessionViewModel.resetToLoginPrompt()

        debugTokensLabel.isVisible = devToolsEnabled
        debugButtonsRow.isVisible = devToolsEnabled
        debugStudentButton.isVisible = devToolsEnabled
        debugAdminButton.isVisible = devToolsEnabled
        debugDeveloperButton.isVisible = devToolsEnabled
        emergencyKioskOffButton.isVisible = devToolsEnabled

        loginButton.setOnClickListener {
            sessionViewModel.authenticate(requireContext().applicationContext, tokenInput.text.toString())
        }

        debugStudentButton.setOnClickListener {
            tokenInput.setText(TestConstants.STUDENT_TOKEN)
        }

        debugAdminButton.setOnClickListener {
            tokenInput.setText(TestConstants.ADMIN_TOKEN)
        }

        debugDeveloperButton.setOnClickListener {
            tokenInput.setText(TestConstants.DEVELOPER_ACCESS_PASSWORD)
        }

        emergencyKioskOffButton.setOnClickListener {
            if (!devToolsEnabled) {
                return@setOnClickListener
            }
            TestUtils.disableKioskForDebug(requireContext(), activity = requireActivity())
            TestUtils.showToast(requireContext(), "Kiosk dimatikan untuk mode debug.")
        }

        openRnUiButton.setOnClickListener {
            val bundleReady = runCatching {
                requireContext().assets.open("index.android.bundle").use { }
                true
            }.getOrDefault(false)
            if (!bundleReady) {
                TestUtils.showToast(requireContext(), "RN bundle tidak ditemukan. Mencoba Metro mode.")
            }
            SessionLogger(requireContext()).append("RN", "Membuka React Native UI host.")
            runCatching {
                // Release lock-task before launching RN activity to avoid transition blocks.
                ScreenLock.clear(requireActivity())
                startActivity(Intent(requireContext(), ReactNativeHostActivity::class.java))
            }.onFailure {
                SessionLogger(requireContext()).append(
                    "RN",
                    "Gagal membuka React Native UI: ${it.message.orEmpty()}"
                )
                TestUtils.showToast(requireContext(), "React Native UI gagal dibuka.")
            }
        }

        exitAppButton.setOnClickListener {
            TestUtils.shutdownApp(requireActivity(), disableKioskForCurrentRun = true)
        }

        loginTitleText.setOnLongClickListener {
            if (!devToolsEnabled) {
                return@setOnLongClickListener false
            }
            TestUtils.disableKioskForDebug(requireContext(), activity = requireActivity())
            TestUtils.showToast(requireContext(), "Emergency unlock aktif.")
            true
        }

        sessionViewModel.statusMessage.observe(viewLifecycleOwner) { message ->
            loginMessage.text = message
        }

        sessionViewModel.loginResult.observe(viewLifecycleOwner) { role ->
            when (role) {
                UserRole.STUDENT -> {
                    sessionViewModel.consumeLoginResult()
                    SessionLogger(requireContext()).append("LOGIN", "Siswa login dengan token demo.")
                    findNavController().navigate(R.id.examFlowTest)
                }

                UserRole.ADMIN -> {
                    sessionViewModel.consumeLoginResult()
                    SessionLogger(requireContext()).append("LOGIN", "Admin/proktor login.")
                    findNavController().navigate(R.id.adminPanelTest)
                }

                UserRole.DEVELOPER -> {
                    if (!devToolsEnabled) {
                        sessionViewModel.consumeLoginResult()
                        SessionLogger(requireContext()).append(
                            "LOGIN",
                            "Developer access blocked in production build."
                        )
                        TestUtils.showToast(requireContext(), "Developer access tidak tersedia.")
                        return@observe
                    }
                    sessionViewModel.consumeLoginResult()
                    SessionLogger(requireContext()).append("LOGIN", "Developer access login.")
                    findNavController().navigate(R.id.developerAccessPanel)
                }

                UserRole.NONE -> Unit
            }
        }
    }
}
