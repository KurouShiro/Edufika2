package com.techivibes.edufika.navigation

import androidx.core.os.bundleOf
import androidx.navigation.NavController
import androidx.navigation.NavOptions
import com.techivibes.edufika.R
import com.techivibes.edufika.utils.TestConstants

object FragmentNavigationTest {

    fun openExam(navController: NavController, url: String, developerBypass: Boolean = false) {
        navController.navigate(
            R.id.examScreen,
            bundleOf(
                TestConstants.ARG_EXAM_URL to url,
                TestConstants.ARG_DEVELOPER_BYPASS to developerBypass
            )
        )
    }

    fun openViolation(navController: NavController, message: String) {
        navController.navigate(
            R.id.violationFragment,
            bundleOf(TestConstants.ARG_VIOLATION_MESSAGE to message)
        )
    }

    fun goToLoginResetStack(navController: NavController) {
        navController.navigate(
            R.id.loginTest,
            null,
            NavOptions.Builder()
                .setLaunchSingleTop(true)
                .setPopUpTo(R.id.loginTest, false)
                .build()
        )
    }
}
