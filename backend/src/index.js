import { conectarMONGO, insertarRegistro, ultimoRegistro, cerrarMONGO } from "./db/mongo.js";

async function main() {
  // Conexión a Mongo
  await conectarMONGO();

  // Insertar un dato de ejemplo
  await insertarRegistro({
    temperature: 100,
    humidity: 37
  });

  console.log("MONGO_URI:", process.env.MONGO_URI);

  // Obtener el último documento insertado
  const ultimo = await ultimoRegistro();
  console.log("Última lectura en la DB:", ultimo);

  // Cerrar conexión
  await cerrarMONGO();
}

main();
