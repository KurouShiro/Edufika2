package com.techivibes.edufika.security

import android.app.Activity
import android.graphics.Rect
import android.os.Build
import android.util.DisplayMetrics
import android.view.WindowInsets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

object WindowModeDetector {

    private const val WIDTH_RATIO_THRESHOLD = 0.82
    private const val HEIGHT_RATIO_THRESHOLD = 0.82
    private const val AREA_RATIO_THRESHOLD = 0.74

    data class Snapshot(
        val inMultiWindow: Boolean,
        val inPictureInPicture: Boolean,
        val compactWindowLikely: Boolean,
        val imeVisible: Boolean,
        val currentWidth: Int,
        val currentHeight: Int,
        val maxWidth: Int,
        val maxHeight: Int
    ) {
        val hasHardSignal: Boolean
            get() = inMultiWindow || inPictureInPicture

        val hasAnySignal: Boolean
            get() = hasHardSignal || compactWindowLikely

        fun summary(): String {
            return "multi=$inMultiWindow pip=$inPictureInPicture compact=$compactWindowLikely ime=$imeVisible current=${currentWidth}x${currentHeight} max=${maxWidth}x${maxHeight}"
        }
    }

    fun capture(activity: Activity?): Snapshot {
        if (activity == null) {
            return Snapshot(
                inMultiWindow = false,
                inPictureInPicture = false,
                compactWindowLikely = false,
                imeVisible = false,
                currentWidth = 0,
                currentHeight = 0,
                maxWidth = 0,
                maxHeight = 0
            )
        }

        val inMultiWindow = runCatching { activity.isInMultiWindowMode }.getOrDefault(false)
        val inPictureInPicture = runCatching { activity.isInPictureInPictureMode }.getOrDefault(false)
        val imeVisible = isImeVisible(activity)
        val dims = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            captureApi30Plus(activity)
        } else {
            captureLegacy(activity)
        }

        // Ignore compact-window heuristic while keyboard is open to avoid false positives.
        val compactWindowLikely = if (imeVisible) false else isCompactWindow(
            currentWidth = dims.currentWidth,
            currentHeight = dims.currentHeight,
            maxWidth = dims.maxWidth,
            maxHeight = dims.maxHeight
        )

        return Snapshot(
            inMultiWindow = inMultiWindow,
            inPictureInPicture = inPictureInPicture,
            compactWindowLikely = compactWindowLikely,
            imeVisible = imeVisible,
            currentWidth = dims.currentWidth,
            currentHeight = dims.currentHeight,
            maxWidth = dims.maxWidth,
            maxHeight = dims.maxHeight
        )
    }

    private data class WindowDims(
        val currentWidth: Int,
        val currentHeight: Int,
        val maxWidth: Int,
        val maxHeight: Int
    )

    private fun captureApi30Plus(activity: Activity): WindowDims {
        val wm = activity.windowManager
        val currentBounds = wm.currentWindowMetrics.bounds
        val maxBounds = wm.maximumWindowMetrics.bounds
        return WindowDims(
            currentWidth = currentBounds.width(),
            currentHeight = currentBounds.height(),
            maxWidth = maxBounds.width(),
            maxHeight = maxBounds.height()
        )
    }

    @Suppress("DEPRECATION")
    private fun captureLegacy(activity: Activity): WindowDims {
        val display = activity.windowManager.defaultDisplay
        val currentMetrics = DisplayMetrics()
        val realMetrics = DisplayMetrics()
        display.getMetrics(currentMetrics)
        display.getRealMetrics(realMetrics)
        return WindowDims(
            currentWidth = currentMetrics.widthPixels,
            currentHeight = currentMetrics.heightPixels,
            maxWidth = realMetrics.widthPixels,
            maxHeight = realMetrics.heightPixels
        )
    }

    private fun isCompactWindow(
        currentWidth: Int,
        currentHeight: Int,
        maxWidth: Int,
        maxHeight: Int
    ): Boolean {
        if (currentWidth <= 0 || currentHeight <= 0 || maxWidth <= 0 || maxHeight <= 0) {
            return false
        }

        val widthRatio = currentWidth.toDouble() / maxWidth.toDouble()
        val heightRatio = currentHeight.toDouble() / maxHeight.toDouble()
        val areaRatio = area(currentWidth, currentHeight).toDouble() / area(maxWidth, maxHeight).toDouble()

        return widthRatio < WIDTH_RATIO_THRESHOLD ||
            heightRatio < HEIGHT_RATIO_THRESHOLD ||
            areaRatio < AREA_RATIO_THRESHOLD
    }

    private fun area(width: Int, height: Int): Long {
        return width.toLong() * height.toLong()
    }

    private fun isImeVisible(activity: Activity): Boolean {
        val rootView = activity.window?.decorView ?: return false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val insets = rootView.rootWindowInsets ?: return false
            return insets.isVisible(WindowInsets.Type.ime())
        }

        val compatInsets = ViewCompat.getRootWindowInsets(rootView)
        if (compatInsets?.isVisible(WindowInsetsCompat.Type.ime()) == true) {
            return true
        }

        val visibleFrame = Rect()
        rootView.getWindowVisibleDisplayFrame(visibleFrame)
        val heightDiff = rootView.height - visibleFrame.height()
        return heightDiff > rootView.height * 0.18
    }
}
