import { logDebug } from './ui.js';

export async function fetchManifest() {
  logDebug("Buscando ./data/manifest.json (Forzando versión fresca)...");
  const response = await fetch('./data/manifest.json?v=' + Date.now());
  if (!response.ok) throw new Error(`HTTP Error ${response.status}. ¿Existe manifest.json?`);
  return await response.json();
}

export async function fetchAllCategories(categories, version) {
  let allConvs = [];
  const appVersion = version || "1.0.0";

  for (const cat of (categories || [])) {
    logDebug(`Leyendo archivo: ${cat.file} (v${appVersion})...`);
    try {
      const response = await fetch(`./${cat.file}?v=${appVersion}`);
      if (response.ok) {
        const data = await response.json();
        allConvs = allConvs.concat(data);
        logDebug(`✅ Éxito: ${cat.file} (${data.length} diálogos)`);
      } else {
        logDebug(`⚠️ No se encontró: ${cat.file}`);
      }
    } catch (err) {
      logDebug(`❌ Error de sintaxis en ${cat.file}: ${err.message}`);
    }
  }
  return allConvs;
}