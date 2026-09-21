package com.docflow.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.util.ArrayList;

/**
 * Speaking and photographing, ON THIS PHONE (v6 §N).
 *
 * §N allows no cloud for this and no silent fallback, and Android makes that
 * easy to get wrong: {@link SpeechRecognizer} transcribes by sending audio to
 * a server BY DEFAULT, and does it well enough that nobody would notice. So
 * this class refuses rather than falls back.
 *
 * Two mechanisms, because one is not available everywhere:
 *
 *  · API 31+ has {@code createOnDeviceSpeechRecognizer}, which cannot reach a
 *    network at all. That is used when it exists.
 *  · Below that, {@code EXTRA_PREFER_OFFLINE} is a REQUEST, not a guarantee —
 *    so on those versions this reports {@code not_on_device} rather than
 *    asking nicely and hoping. A phone that cannot promise is a phone that is
 *    told it cannot, which is §N's own rule about unsupported devices.
 *
 * OCR has no such trap: ML Kit's Latin recogniser is a bundled on-device
 * model and never leaves the phone. It is declared in the manifest so the
 * model ships with the app rather than being fetched on first use, which
 * would be a network dependency by another name (Rule #2).
 *
 * REASONS ARE CODES. Every failure returns one of the strings the TypeScript
 * port names; none of them is a sentence. The words belong to the catalogue
 * (Rule #4), and a plugin that returned English would be deciding what
 * language the app speaks.
 */
@CapacitorPlugin(
    name = "Capture",
    permissions = {
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }),
        @Permission(alias = "camera", strings = { Manifest.permission.CAMERA })
    }
)
public class CapturePlugin extends Plugin {

    private SpeechRecognizer recognizer;
    private PluginCall listening;
    private final StringBuilder heard = new StringBuilder();

    /**
     * Whether this phone can transcribe without sending audio away.
     *
     * The whole gate. Below API 31 the answer is no — not "probably", not
     * "with a flag set": {@code EXTRA_PREFER_OFFLINE} is advisory and a
     * recogniser is free to ignore it, so promising on-device on those
     * versions would be a promise this code cannot keep.
     */
    private boolean canListenOnDevice() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return false;
        return SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext());
    }

    @PluginMethod
    public void speechAvailability(PluginCall call) {
        JSObject result = new JSObject();
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            result.put("ok", false);
            result.put("why", "no_engine");
        } else if (!canListenOnDevice()) {
            // The one §N exists for: it works, but only by leaving the phone.
            result.put("ok", false);
            result.put("why", "not_on_device");
        } else {
            result.put("ok", true);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void textAvailability(PluginCall call) {
        JSObject result = new JSObject();
        // The Latin model is bundled with the app; there is nothing to fetch
        // and nothing to be offline for.
        result.put("ok", true);
        call.resolve(result);
    }

    @PluginMethod
    public void listen(PluginCall call) {
        if (!canListenOnDevice()) {
            call.reject("not_on_device");
            return;
        }
        if (getPermissionState("microphone") != com.getcapacitor.PermissionState.GRANTED) {
            call.setKeepAlive(true);
            requestPermissionForAlias("microphone", call, "microphoneResult");
            return;
        }
        startListening(call);
    }

    @PermissionCallback
    private void microphoneResult(PluginCall call) {
        if (getPermissionState("microphone") != com.getcapacitor.PermissionState.GRANTED) {
            call.reject("no_permission");
            return;
        }
        startListening(call);
    }

    private void startListening(PluginCall call) {
        listening = call;
        call.setKeepAlive(true);
        heard.setLength(0);

        String locale = call.getString("locale", "en-NG");

        getActivity().runOnUiThread(() -> {
            try {
                if (recognizer != null) recognizer.destroy();
                recognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(getContext());

                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(
                    RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                    RecognizerIntent.LANGUAGE_MODEL_FREE_FORM
                );
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale);
                // Belt and braces: the on-device recogniser cannot reach a
                // network anyway, and saying so twice costs nothing.
                intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
                intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);

                recognizer.setRecognitionListener(new RecognitionListener() {
                    @Override public void onReadyForSpeech(Bundle params) {}
                    @Override public void onBeginningOfSpeech() {}
                    @Override public void onRmsChanged(float rms) {}
                    @Override public void onBufferReceived(byte[] buffer) {}
                    @Override public void onEndOfSpeech() {}
                    @Override public void onEvent(int type, Bundle params) {}

                    @Override
                    public void onPartialResults(Bundle partial) {
                        ArrayList<String> words =
                            partial.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        if (words != null && !words.isEmpty()) {
                            heard.setLength(0);
                            heard.append(words.get(0));
                        }
                    }

                    @Override
                    public void onResults(Bundle results) {
                        ArrayList<String> words =
                            results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        String text = words != null && !words.isEmpty() ? words.get(0) : "";
                        finish(text, false);
                    }

                    @Override
                    public void onError(int code) {
                        /*
                         * WHATEVER WAS HEARD STILL COUNTS (§N).
                         *
                         * "Failure always offers Continue manually with
                         * whatever was recovered" — so a run that broke after
                         * catching half a sentence returns that half, marked
                         * partial, rather than throwing it away and showing
                         * an error over an empty screen.
                         */
                        if (heard.length() > 0) {
                            finish(heard.toString(), true);
                            return;
                        }
                        reject(refusalFor(code));
                    }
                });

                recognizer.startListening(intent);
            } catch (Exception failure) {
                reject("engine_failed");
            }
        });
    }

    /** Android's error codes, as the reasons a person can be told about. */
    private String refusalFor(int code) {
        switch (code) {
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                return "no_permission";
            case SpeechRecognizer.ERROR_NO_MATCH:
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                return "nothing_captured";
            case SpeechRecognizer.ERROR_CLIENT:
                return "cancelled";
            case SpeechRecognizer.ERROR_NETWORK:
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                /*
                 * An on-device recogniser reporting a NETWORK error means the
                 * phone fell back to one that is not. Reported as what it is,
                 * never as a connection problem to retry (§N).
                 */
                return "not_on_device";
            default:
                return "engine_failed";
        }
    }

    private void finish(String text, boolean partial) {
        PluginCall call = listening;
        listening = null;
        if (recognizer != null) {
            recognizer.destroy();
            recognizer = null;
        }
        if (call == null) return;
        if (text == null || text.trim().isEmpty()) {
            call.reject("nothing_captured");
            return;
        }
        JSObject result = new JSObject();
        result.put("text", text);
        result.put("partial", partial);
        call.resolve(result);
    }

    private void reject(String refusal) {
        PluginCall call = listening;
        listening = null;
        if (recognizer != null) {
            recognizer.destroy();
            recognizer = null;
        }
        if (call != null) call.reject(refusal);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (recognizer != null) recognizer.stopListening();
        });
        call.resolve();
    }

    // ---------------------------------------------------------------- OCR

    @PluginMethod
    public void readText(PluginCall call) {
        String source = call.getString("source", "camera");
        if ("camera".equals(source)
            && getPermissionState("camera") != com.getcapacitor.PermissionState.GRANTED) {
            call.setKeepAlive(true);
            requestPermissionForAlias("camera", call, "cameraResult");
            return;
        }
        openPicker(call, source);
    }

    @PermissionCallback
    private void cameraResult(PluginCall call) {
        if (getPermissionState("camera") != com.getcapacitor.PermissionState.GRANTED) {
            call.reject("no_permission");
            return;
        }
        openPicker(call, call.getString("source", "camera"));
    }

    private void openPicker(PluginCall call, String source) {
        Intent intent;
        if ("camera".equals(source)) {
            intent = new Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE);
        } else {
            intent = new Intent(Intent.ACTION_PICK);
            intent.setType("image/*");
        }
        startActivityForResult(call, intent, "pickedImage");
    }

    @ActivityCallback
    private void pickedImage(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != android.app.Activity.RESULT_OK) {
            call.reject("cancelled");
            return;
        }

        Intent data = result.getData();
        InputImage image;
        try {
            if (data != null && data.getData() != null) {
                Uri uri = data.getData();
                image = InputImage.fromFilePath(getContext(), uri);
            } else if (data != null && data.getExtras() != null
                && data.getExtras().get("data") instanceof android.graphics.Bitmap) {
                image = InputImage.fromBitmap(
                    (android.graphics.Bitmap) data.getExtras().get("data"), 0);
            } else {
                call.reject("nothing_captured");
                return;
            }
        } catch (Exception failure) {
            call.reject("engine_failed");
            return;
        }

        // The bundled Latin model. Nothing is fetched and nothing is sent.
        TextRecognizer reader = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        reader.process(image)
            .addOnSuccessListener(text -> {
                String found = text.getText();
                if (found == null || found.trim().isEmpty()) {
                    call.reject("nothing_captured");
                    return;
                }
                JSObject out = new JSObject();
                out.put("text", found);
                out.put("partial", false);
                call.resolve(out);
            })
            .addOnFailureListener(failure -> call.reject("engine_failed"));
    }
}
