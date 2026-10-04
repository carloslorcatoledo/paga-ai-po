# Plan: app para dividir cuentas entre amigos

## 1. Concepto central

La idea clave que resuelve tu problema: **dividir por ítem, no por total**. En vez de "total ÷ personas", cada producto se asigna solo a quienes lo consumieron.

Ejemplo: 5 amigos, 2 no beben.
- Pizza $20.000 → entre los 5 ($4.000 c/u)
- Cervezas $15.000 → solo entre los 3 que beben ($5.000 c/u)
- Los 2 que no beben pagan $4.000, los otros 3 pagan $9.000

## 2. Funcionalidades (por prioridad)

**MVP (lo mínimo para que sea útil)**
- Crear un "evento" o salida y agregar participantes (solo nombres, sin registro)
- Agregar gastos: nombre, monto, quién pagó, **quiénes participaron en ese ítem**
- Categorías rápidas con íconos (comida, alcohol, bebidas, transporte, otros)
- Resumen final: cuánto debe cada persona y a quién
- Compartir el resumen por WhatsApp (texto o imagen)

**Versión 2**
- Propina/servicio (porcentaje que se reparte proporcionalmente al consumo de cada uno)
- División por partes desiguales (ej. "yo comí 2 porciones")
- Simplificación de deudas (minimizar transferencias: si A le debe a B y B a C, que A le pague directo a C)
- Historial de eventos
- Varias monedas

**Versión 3**
- Cuentas de usuario y eventos compartidos en tiempo real (cada amigo agrega sus gastos desde su celular)
- Escanear boleta con OCR y asignar ítems tocando
- Datos de transferencia (banco, cuenta) para facilitar el pago
- Recordatorios de deudas pendientes

## 3. Modelo de datos (simple)

- **Evento**: id, nombre, fecha, moneda
- **Participante**: id, evento, nombre
- **Gasto**: id, evento, descripción, monto, categoría, pagado_por
- **Gasto_Participante**: gasto, participante (quién consumió ese ítem)

Con estas 4 tablas se calcula todo. Como vienes de SQL, esto te resultará muy natural: el saldo de cada persona es `lo que pagó − lo que le corresponde`.

## 4. Lógica de cálculo

1. Por cada gasto: `cuota = monto ÷ nº de participantes de ese gasto`
2. Por persona: `debe_total = suma de sus cuotas`
3. Saldo = `pagó_total − debe_total` (positivo = le deben, negativo = debe)
4. Para simplificar deudas: emparejar al mayor deudor con el mayor acreedor repetidamente hasta saldar todo

Ojo con los redondeos: en monedas sin decimales (como CLP) hay que repartir el residuo (ej. $10.000 entre 3 = 3.333 + 3.333 + 3.334).

## 5. Opciones de tecnología

| Opción | Ventajas | Desventajas |
|---|---|---|
| **PWA** (React + Vite + Tailwind) | Sin tiendas, se instala desde el navegador, un solo código, rápida de iterar | Menos acceso a funciones nativas |
| **Flutter** | Apariencia nativa, Android e iOS | Aprender Dart |
| **React Native / Expo** | Si ya sabes JavaScript | Más configuración que una PWA |

**Mi recomendación:** empezar con una **PWA con almacenamiento local** (sin servidor). Es lo más rápido para validar la idea, funciona sin internet y puedes publicarla gratis en GitHub Pages (que ya usas para tu portafolio). Cuando quieras eventos compartidos en tiempo real, agregas **Supabase** (base de datos Postgres + autenticación gratis al inicio).

## 6. Diseño y experiencia (simple y moderno)

- **Mobile-first**: botones grandes, todo alcanzable con el pulgar, botón flotante "+ Gasto"
- **Flujo en 3 pasos**: 1) agregar gente → 2) agregar gastos tocando las caras de quienes participaron → 3) ver resultado
- Chips con avatares/iniciales de colores para seleccionar participantes (un toque para activar/desactivar)
- Modo oscuro (útil en una fiesta de noche)
- Resultado visual claro: tarjetas por persona con "debe $X" en rojo y "le deben $X" en verde

## 7. Plan de desarrollo por fases

| Fase | Entregable | Duración estimada |
|---|---|---|
| 0. Diseño | Bocetos de 4 pantallas (inicio, participantes, gastos, resumen) en papel o Figma | 2-3 días |
| 1. Lógica | Función de cálculo con pruebas (casos: alcohol, redondeos, quien paga) | 3-4 días |
| 2. MVP | Interfaz + guardado local + compartir por WhatsApp | 1-2 semanas |
| 3. Pulido | Propina, modo oscuro, instalación como app, pruebas con amigos reales | 1 semana |
| 4. Nube | Eventos compartidos, cuentas de usuario | 2-3 semanas |

## 8. Riesgos a considerar

- **Complejidad de la interfaz**: si asignar ítems toma muchos toques, nadie la usará borracho a las 3 AM. Probar con amigos temprano.
- **Redondeos**: son la fuente más común de errores en estas apps.
- **Competencia**: existen Splitwise y Tricount; tu diferenciador puede ser la simplicidad extrema y el flujo "por ítem" más rápido.

## 9. Próximos pasos

1. Definir el nombre de la app y su público (¿solo para ti y tus amigos, o para publicar?)
2. Dibujar las 4 pantallas del MVP
3. Escribir y probar la función de cálculo primero (es el corazón)
4. Armar la interfaz sobre esa lógica

---

## Estado del prototipo (2026-10-04)

Este repositorio ya incluye un **prototipo funcional** del MVP:

- `calc.js` — la lógica de cálculo (división por ítem, saldos, redondeo CLP, simplificación de deudas). Es el "corazón", puro y sin dependencias.
- `calc.test.js` — pruebas de la lógica. Se corren con `node --test`.
- `index.html` — la app (mobile-first, modo oscuro, guardado local, compartir por WhatsApp). Se abre en el navegador o se prueba en el celular.
- `README.md` — cómo correrlo, probarlo y publicarlo en GitHub Pages.

Nombre de trabajo provisional: **Reparte** (cambiar en el paso 9).
