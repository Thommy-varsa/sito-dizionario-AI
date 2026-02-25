const API_KEY = "AIzaSyBI_m7zMXiutr_pHshY4FwnMqIk4BwadIs"; // <-- sostituisci temporaneamente per test locale
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const analyzeBtn = document.getElementById("analyzeBtn");
const inputText = document.getElementById("inputText");
const targetLanguage = document.getElementById("targetLanguage");
const outputResult = document.getElementById("outputResult");

function escapeHtml(str){
  return String(str || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

async function listModels() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
  const r = await fetch(url);
  const txt = await r.text();
  try {
    return JSON.parse(txt);
  } catch (e) {
    throw new Error("ListModels: risposta non JSON: " + txt);
  }
}

function chooseModel(modelsResponse) {
  // modelsResponse dovrebbe avere un array 'models' con oggetti che potrebbero contenere 'name' e 'supportedMethods'
  const models = modelsResponse?.models || [];
  // preferiamo un modello che supporti generateContent; altrimenti generateText
  let chosen = null;
  for (const m of models) {
    const methods = m?.supportedMethods || [];
    if (methods.includes("generateContent")) {
      chosen = { name: m.name, method: "generateContent" };
      break;
    }
  }
  if (!chosen) {
    for (const m of models) {
      const methods = m?.supportedMethods || [];
      if (methods.includes("generateText")) {
        chosen = { name: m.name, method: "generateText" };
        break;
      }
    }
  }
  // fallback: se non troviamo nulla, proviamo con text-bison-001 generateText (comune)
  if (!chosen) {
    chosen = { name: "text-bison-001", method: "generateText" };
  }
  return chosen;
}

async function callGenerateWithModel(model, promptCompleto) {
  if (!model) throw new Error("Modello non selezionato");
  const modelName = model.name.replace(/^models\//, ""); // assicurarsi formato
  if (model.method === "generateContent") {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;
    const body = {
      contents: [
        { parts: [{ text: promptCompleto }] }
      ]
    };
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch(e){ throw new Error("generateContent: risposta non JSON: " + text); }
    if (!resp.ok) {
      const err = data?.error?.message || JSON.stringify(data);
      throw new Error(`API error: ${resp.status} ${resp.statusText} - ${err}`);
    }
    // parsing robusto per generateContent
    const result =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      data?.candidates?.[0]?.content?.[0]?.text ||
      data?.outputs?.[0]?.content?.parts?.[0]?.text ||
      null;
    return result;
  } else if (model.method === "generateText") {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateText?key=${API_KEY}`;
    const body = {
      prompt: { text: promptCompleto }
    };
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch(e){ throw new Error("generateText: risposta non JSON: " + text); }
    if (!resp.ok) {
      const err = data?.error?.message || JSON.stringify(data);
      throw new Error(`API error: ${resp.status} ${resp.statusText} - ${err}`);
    }
    // parsing robusto per generateText
    const candidates = data?.candidates;
    let result =
      data?.output?.[0]?.content?.[0]?.text ||
      data?.outputs?.[0]?.content?.parts?.[0]?.text ||
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      data?.candidates?.[0]?.output ||
      null;
    if (!result && Array.isArray(candidates) && candidates.length > 0) {
      const c0 = candidates[0];
      result = c0?.output || c0?.text || c0?.content?.[0]?.text || null;
    }
    return result;
  } else {
    throw new Error("Metodo del modello non gestito: " + model.method);
  }
}

analyzeBtn.addEventListener("click", async () => {
  const testo = inputText.value.trim();
  const lingua = targetLanguage.value;

  if (!testo) {
    outputResult.innerText = "Inserisci un testo da tradurre/analizzare.";
    return;
  }

  if (!API_KEY || API_KEY === "YOUR_API_KEY_HERE") {
    outputResult.innerText = "Errore: non hai impostato l'API_KEY nel file script.js. Per test locale sostituisci il placeholder, oppure usa il proxy server.";
    return;
  }

  const promptCompleto =
    "Agisci come un professore di lingue. " +
    "Traduci il seguente testo in " + lingua +
    " e poi fornisci una spiegazione grammaticale e un esempio pratico di utilizzo.\n\n" +
    "Testo: \"" + testo + "\"";

  analyzeBtn.disabled = true;
  outputResult.innerText = "Sto verificando i modelli disponibili... (controlla la Console per i dettagli)";

  try {
    // 1) ListModels
    let modelsResp;
    try {
      modelsResp = await listModels();
      console.log("ListModels response:", modelsResp);
    } catch (e) {
      // Probabile CORS o chiave non valida; rilanciamo con messaggio utile
      throw new Error("Impossibile ottenere la lista modelli: " + e.message + ". Se usi questo client dal browser potresti incontrare CORS. Usa un proxy server o esegui curl dal terminale per ListModels.");
    }

    // 2) Scegli modello adatto
    const modelChoice = chooseModel(modelsResp);
    console.log("Modello scelto:", modelChoice);

    outputResult.innerText = `Usando modello ${modelChoice.name} con metodo ${modelChoice.method}...`;

    // 3) Chiamata generate (con parsing robusto)
    const resultText = await callGenerateWithModel(modelChoice, promptCompleto);

    if (!resultText) {
      outputResult.innerText = "Nessun testo restituito dall'API. Controlla la Console per la struttura completa della risposta e la lista dei modelli.";
      console.log("Nessun text trovato nella risposta del modello.");
    } else {
      outputResult.innerHTML = escapeHtml(resultText);
    }

  } catch (err) {
    console.error("Errore chiamata AI:", err);
    // Messaggi utente utili
    let msg = err.message || String(err);
    if (msg.includes("404") && msg.includes("not found")) {
      msg += "\nSuggerimento: il modello potrebbe non supportare il metodo richiesto. Controlla la lista modelli (console) e scegli un modello che supporti generateContent o generateText.";
    }
    if (msg.toLowerCase().includes("cors") || msg.includes("Impossibile ottenere la lista modelli")) {
      msg += "\nSuggerimento: potresti essere bloccato da CORS. Per aggirarlo, crea un piccolo proxy sul server (Node/Express) che contenga la API key e che inoltri la richiesta a Google.";
    }
    outputResult.innerText = "Si è verificato un errore: " + msg;
  } finally {
    analyzeBtn.disabled = false;
  }
});