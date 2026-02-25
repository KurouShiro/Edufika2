package com.techivibes.edufika.security

import android.os.Bundle
import android.view.View
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.google.android.material.button.MaterialButton
import com.techivibes.edufika.BuildConfig
import com.techivibes.edufika.R
import com.techivibes.edufika.data.SessionState
import com.techivibes.edufika.navigation.FragmentNavigationTest
import com.techivibes.edufika.security.ScreenOffReceiver
import com.techivibes.edufika.utils.TestConstants
import com.techivibes.edufika.utils.TestUtils

class ViolationFragment : Fragment(R.layout.fragment_violation) {

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val message = arguments?.getString(TestConstants.ARG_VIOLATION_MESSAGE)
            ?: "Pelanggaran sistem terdeteksi."

        view.findViewById<TextView>(R.id.violationMessageText).text = message
        view.findViewById<MaterialButton>(R.id.violationBackButton).setOnClickListener {
            ScreenOffReceiver.stopAlarm()
            SessionState.clear()
            if (BuildConfig.DEV_TOOLS_ENABLED) {
                TestUtils.disableKioskForDebug(requireContext(), activity = requireActivity())
            } else {
                TestUtils.enableKiosk(requireContext(), activity = requireActivity())
            }
            FragmentNavigationTest.goToLoginResetStack(findNavController())
        }
    }
}
