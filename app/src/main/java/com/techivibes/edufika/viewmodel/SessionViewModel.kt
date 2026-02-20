package com.techivibes.edufika.viewmodel

import android.content.Context
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.techivibes.edufika.backend.SessionClient
import com.techivibes.edufika.data.SessionState
import com.techivibes.edufika.data.TokenRegistry
import com.techivibes.edufika.data.UserRole
import com.techivibes.edufika.utils.TestConstants
import kotlinx.coroutines.launch

class SessionViewModel : ViewModel() {

    private val _loginResult = MutableLiveData(UserRole.NONE)
    val loginResult: LiveData<UserRole> = _loginResult

    private val _statusMessage = MutableLiveData(
        "Debug token: StudentID | AdminID | EDU_DEV_ACCESS"
    )
    val statusMessage: LiveData<String> = _statusMessage

    fun authenticate(context: Context, rawToken: String) {
        val token = rawToken.trim()
        if (token.isBlank()) {
            _statusMessage.value = "Session token tidak boleh kosong."
            _loginResult.value = UserRole.NONE
            return
        }
        TokenRegistry.purgeExpired(context)
        val normalized = token.uppercase()
        when {
            normalized == TestConstants.STUDENT_TOKEN.uppercase() ||
                normalized == "STUDENT" -> {
                SessionState.startSession(token, UserRole.STUDENT)
                _statusMessage.value = "Login siswa berhasil."
                _loginResult.value = UserRole.STUDENT
            }

            normalized == TestConstants.ADMIN_TOKEN.uppercase() ||
                normalized == "ADMIN" -> {
                SessionState.startSession(token, UserRole.ADMIN)
                _statusMessage.value = "Login admin/proktor berhasil."
                _loginResult.value = UserRole.ADMIN
            }

            normalized == TestConstants.DEVELOPER_ACCESS_PASSWORD.uppercase() ||
                normalized == "DEV" -> {
                SessionState.startSession(token, UserRole.DEVELOPER)
                _statusMessage.value = "Developer access granted."
                _loginResult.value = UserRole.DEVELOPER
            }

            else -> {
                val issuedToken = TokenRegistry.findToken(context, token)
                if (issuedToken != null && issuedToken.isExpired()) {
                    _statusMessage.value = "Token sudah kedaluwarsa."
                    _loginResult.value = UserRole.NONE
                    return
                }

                val roleHint = when {
                    issuedToken != null -> when (issuedToken.role) {
                        UserRole.ADMIN -> "admin"
                        UserRole.DEVELOPER -> "developer"
                        UserRole.STUDENT -> "student"
                        UserRole.NONE -> "student"
                    }
                    normalized.startsWith("A-") -> "admin"
                    normalized.startsWith("S-") -> "student"
                    else -> "student"
                }
                _statusMessage.value = "Validasi token ke server..."
                viewModelScope.launch {
                    val response = SessionClient(context).claimSession(token, roleHint = roleHint)
                    if (response != null) {
                        val role = when (response.role.lowercase()) {
                            "admin", "proctor", "proktor" -> UserRole.ADMIN
                            "developer" -> UserRole.DEVELOPER
                            else -> UserRole.STUDENT
                        }
                        val resolvedExpiry = response.tokenExpiresAtMillis ?: issuedToken?.expiresAtMillis
                        SessionState.startSession(
                            token = token,
                            role = role,
                            sessionExpiresAtMillis = resolvedExpiry,
                            serverSessionId = response.sessionId,
                            signature = response.accessSignature,
                            bindingId = response.deviceBindingId
                        )
                        _statusMessage.value = "Session token tervalidasi oleh server."
                        _loginResult.value = role
                        return@launch
                    }

                    if (issuedToken != null && !issuedToken.isExpired()) {
                        SessionState.startSession(
                            token = token,
                            role = issuedToken.role,
                            sessionExpiresAtMillis = issuedToken.expiresAtMillis
                        )
                        _statusMessage.value = "Token lokal valid dipakai."
                        _loginResult.value = issuedToken.role
                        return@launch
                    }

                    _statusMessage.value = "Session token tidak valid."
                    _loginResult.value = UserRole.NONE
                }
            }
        }
    }

    fun consumeLoginResult() {
        _loginResult.value = UserRole.NONE
    }

    fun resetToLoginPrompt() {
        _statusMessage.value = "Debug token: StudentID | AdminID | EDU_DEV_ACCESS"
        _loginResult.value = UserRole.NONE
    }
}
