package com.techivibes.edufika.utils

import android.os.Build

object DeviceCompatibility {
    fun isAndroid10OrAbove(): Boolean = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q

    fun supportsLockTask(): Boolean = Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP

    fun supportsProcessLifecycleObserver(): Boolean = true
}
