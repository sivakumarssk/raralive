package expo.modules.smsconsent

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Status
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val CONSENT_REQUEST = 24610

/**
 * Google's SMS User Consent API: for up to 5 minutes after start(), the next
 * SMS containing a one-time code makes Android ask the user whether this app
 * may read it. Needs no SMS permission and no change to the SMS text. The
 * approved message is sent to JS as an "onSms" event.
 */
class SmsConsentModule : Module() {
  private var receiver: BroadcastReceiver? = null

  override fun definition() = ModuleDefinition {
    Name("SmsConsent")
    Events("onSms")

    Function("start") { start() }
    Function("stop") { stopListening() }

    OnActivityResult { _, payload ->
      if (payload.requestCode == CONSENT_REQUEST && payload.resultCode == Activity.RESULT_OK) {
        payload.data?.getStringExtra(SmsRetriever.EXTRA_SMS_MESSAGE)?.let { message ->
          sendEvent("onSms", mapOf("message" to message))
        }
      }
    }

    OnDestroy { stopListening() }
  }

  private fun start() {
    val context = appContext.reactContext ?: return
    stopListening()

    val smsReceiver = object : BroadcastReceiver() {
      override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.action != SmsRetriever.SMS_RETRIEVED_ACTION) return
        stopListening() // one SMS per start()
        val extras = intent.extras ?: return
        if (statusOf(extras) != CommonStatusCodes.SUCCESS) return // 5-minute timeout
        showConsent(ctx, consentIntentOf(extras) ?: return)
      }
    }

    val filter = IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION)
    // Only Play services can send this broadcast
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(smsReceiver, filter, SmsRetriever.SEND_PERMISSION, null, Context.RECEIVER_EXPORTED)
    } else {
      context.registerReceiver(smsReceiver, filter, SmsRetriever.SEND_PERMISSION, null)
    }
    receiver = smsReceiver

    // null = any sender: India's DLT headers arrive with varying operator
    // prefixes, so the JS side checks the approved text instead.
    SmsRetriever.getClient(context).startSmsUserConsent(null)
  }

  private fun stopListening() {
    val current = receiver ?: return
    receiver = null
    runCatching { appContext.reactContext?.unregisterReceiver(current) }
  }

  /** Opens the consent screen, but only if it really is Google's (intent redirection guard). */
  private fun showConsent(context: Context, consent: Intent) {
    val target = consent.resolveActivity(context.packageManager) ?: return
    val grantsUriAccess = consent.flags and
      (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION) != 0
    if (target.packageName != "com.google.android.gms" || grantsUriAccess) return
    runCatching { appContext.currentActivity?.startActivityForResult(consent, CONSENT_REQUEST) }
  }

  @Suppress("DEPRECATION")
  private fun statusOf(extras: Bundle): Int? =
    (extras.get(SmsRetriever.EXTRA_STATUS) as? Status)?.statusCode

  @Suppress("DEPRECATION")
  private fun consentIntentOf(extras: Bundle): Intent? =
    extras.getParcelable(SmsRetriever.EXTRA_CONSENT_INTENT)
}
