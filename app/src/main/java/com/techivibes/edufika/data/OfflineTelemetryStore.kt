package com.techivibes.edufika.data

import android.content.Context
import com.techivibes.edufika.utils.TestConstants
import org.json.JSONArray
import org.json.JSONObject

object OfflineTelemetryStore {
    private const val MAX_QUEUE_SIZE = 200

    fun enqueueEvent(
        context: Context,
        eventType: String,
        detail: String,
        riskScore: Int,
        metadata: JSONObject? = null
    ) {
        val item = JSONObject()
            .put("event_type", eventType.trim())
            .put("detail", detail)
            .put("risk_score", riskScore)
            .put("timestamp", System.currentTimeMillis())
        if (metadata != null) {
            item.put("metadata", metadata)
        }
        val next = readQueue(context, TestConstants.PREF_OFFLINE_EVENT_QUEUE)
        next.put(item)
        trimToLimit(next)
        writeQueue(context, TestConstants.PREF_OFFLINE_EVENT_QUEUE, next)
    }

    fun enqueueHeartbeatSnapshot(context: Context, payload: JSONObject) {
        val item = JSONObject()
            .put("payload", payload)
            .put("timestamp", System.currentTimeMillis())
        val next = readQueue(context, TestConstants.PREF_OFFLINE_HEARTBEAT_QUEUE)
        next.put(item)
        trimToLimit(next)
        writeQueue(context, TestConstants.PREF_OFFLINE_HEARTBEAT_QUEUE, next)
    }

    fun readEvents(context: Context, limit: Int): List<JSONObject> {
        return readQueue(context, TestConstants.PREF_OFFLINE_EVENT_QUEUE).toObjectList(limit)
    }

    fun readHeartbeats(context: Context, limit: Int): List<JSONObject> {
        return readQueue(context, TestConstants.PREF_OFFLINE_HEARTBEAT_QUEUE).toObjectList(limit)
    }

    fun dropEvents(context: Context, count: Int) {
        val queue = readQueue(context, TestConstants.PREF_OFFLINE_EVENT_QUEUE)
        dropHead(queue, count)
        writeQueue(context, TestConstants.PREF_OFFLINE_EVENT_QUEUE, queue)
    }

    fun dropHeartbeats(context: Context, count: Int) {
        val queue = readQueue(context, TestConstants.PREF_OFFLINE_HEARTBEAT_QUEUE)
        dropHead(queue, count)
        writeQueue(context, TestConstants.PREF_OFFLINE_HEARTBEAT_QUEUE, queue)
    }

    private fun readQueue(context: Context, key: String): JSONArray {
        val raw = context.getSharedPreferences(TestConstants.PREFS_NAME, Context.MODE_PRIVATE)
            .getString(key, null)
            ?: return JSONArray()
        return runCatching { JSONArray(raw) }.getOrElse { JSONArray() }
    }

    private fun writeQueue(context: Context, key: String, queue: JSONArray) {
        context.getSharedPreferences(TestConstants.PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(key, queue.toString())
            .apply()
    }

    private fun dropHead(queue: JSONArray, count: Int) {
        if (count <= 0 || queue.length() == 0) return
        val kept = JSONArray()
        for (i in count until queue.length()) {
            kept.put(queue.opt(i))
        }
        queue.clearAndCopyFrom(kept)
    }

    private fun trimToLimit(queue: JSONArray) {
        if (queue.length() <= MAX_QUEUE_SIZE) return
        val start = queue.length() - MAX_QUEUE_SIZE
        val trimmed = JSONArray()
        for (i in start until queue.length()) {
            trimmed.put(queue.opt(i))
        }
        queue.clearAndCopyFrom(trimmed)
    }
}

private fun JSONArray.toObjectList(limit: Int): List<JSONObject> {
    val safeLimit = limit.coerceAtLeast(0)
    val output = mutableListOf<JSONObject>()
    val stop = kotlin.math.min(length(), safeLimit)
    for (i in 0 until stop) {
        optJSONObject(i)?.let(output::add)
    }
    return output
}

private fun JSONArray.clearAndCopyFrom(other: JSONArray) {
    while (length() > 0) {
        remove(0)
    }
    for (i in 0 until other.length()) {
        put(other.opt(i))
    }
}

