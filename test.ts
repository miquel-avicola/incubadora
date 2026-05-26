import { calcularPrevisioFinal } from './lib/previsio';

async function main() {
  const res = await calcularPrevisioFinal(2, 'Ross', 63, 'Multistage', '2026-05-26');
  console.log(JSON.stringify(res, null, 2));
}

main().catch(console.error);
