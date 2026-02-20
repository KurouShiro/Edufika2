package com.techivibes.edufika.data

import android.content.Context
import com.techivibes.edufika.utils.TestConstants
import org.json.JSONArray
import org.json.JSONObject

data class IssuedTokenEntry(
    val token: String,
    val role: UserRole,
    val expiresAtMillis: Long,
    val createdAtMillis: Long,
    val source: String,
    val sessionId: String?
) {
    fun isExpired(nowMillis: Long = System.currentTimeMillis()): Boolean {
        return nowMillis >= expiresAtMillis
    }
}

object TokenRegistry {

    fun issueToken(
        context: Context,
        token: String,
        role: UserRole,
        expiryMinutes: Int,
        source: String,
        sessionId: String? = null
    ): IssuedTokenEntry {
        val now = System.currentTimeMillis()
        val boundedExpiry = expiryMinutes
            .coerceAtLeast(TestConstants.MIN_TOKEN_EXPIRY_MINUTES)
            .coerceAtMost(TestConstants.MAX_TOKEN_EXPIRY_MINUTES)
        val expiresAt = now + boundedExpiry * 60_000L
        val entry = IssuedTokenEntry(
            token = token,
            role = role,
            expiresAtMillis = expiresAt,
            createdAtMillis = now,
            source = source,
            sessionId = sessionId
        )

        val current = load(context).toMutableList()
            .filterNot { it.token.equals(token, ignoreCase = true) }
            .toMutableList()
        current.add(entry)
        persist(context, current)
        return entry
    }

    fun findToken(context: Context, rawToken: String): IssuedTokenEntry? {
        val token = rawToken.trim()
        if (token.isBlank()) return null
        return load(context).firstOrNull { it.token.equals(token, ignoreCase = true) }
    }

    fun findValidToken(context: Context, rawToken: String): IssuedTokenEntry? {
        val entry = findToken(context, rawToken) ?: return null
        return if (entry.isExpired()) null else entry
    }

    fun purgeExpired(context: Context) {
        val now = System.currentTimeMillis()
        val active = load(context).filterNot { it.isExpired(now) }
        persist(context, active)
    }

    private fun prefs(context: Context) =
        context.getSharedPreferences(TestConstants.PREFS_NAME, Context.MODE_PRIVATE)

    private fun load(context: Context): List<IssuedTokenEntry> {
        val raw = prefs(context).getString(TestConstants.PREF_ISSUED_TOKENS, null) ?: return emptyList()
        val array = runCatching { JSONArray(raw) }.getOrNull() ?: return emptyList()
        val output = mutableListOf<IssuedTokenEntry>()

        for (index in 0 until array.length()) {
            val node = array.optJSONObject(index) ?: continue
            val token = node.optString("token").trim()
            val role = parseRole(node.optString("role"))
            val expiresAt = node.optLong("expires_at", 0L)
            val createdAt = node.optLong("created_at", 0L)
            val source = node.optString("source", "unknown")
            val sessionId = node.optString("session_id").ifBlank { null }
            if (token.isBlank() || role == UserRole.NONE || expiresAt <= 0L) continue
            output.add(
                IssuedTokenEntry(
                    token = token,
                    role = role,
                    expiresAtMillis = expiresAt,
                    createdAtMillis = createdAt,
                    source = source,
                    sessionId = sessionId
                )
            )
        }

        return output
    }

    private fun persist(context: Context, entries: List<IssuedTokenEntry>) {
        val array = JSONArray()
        entries.forEach { entry ->
            array.put(
                JSONObject()
                    .put("token", entry.token)
                    .put("role", entry.role.name)
                    .put("expires_at", entry.expiresAtMillis)
                    .put("created_at", entry.createdAtMillis)
                    .put("source", entry.source)
                    .put("session_id", entry.sessionId ?: "")
            )
        }
        prefs(context)
            .edit()
            .putString(TestConstants.PREF_ISSUED_TOKENS, array.toString())
            .apply()
    }

    private fun parseRole(raw: String): UserRole {
        return when (raw.uppercase()) {
            UserRole.STUDENT.name -> UserRole.STUDENT
            UserRole.ADMIN.name -> UserRole.ADMIN
            UserRole.DEVELOPER.name -> UserRole.DEVELOPER
            else -> UserRole.NONE
        }
    }
}
