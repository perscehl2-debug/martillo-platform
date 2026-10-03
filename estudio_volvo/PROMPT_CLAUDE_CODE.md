# Instrucciones para Claude Code

Copia y pega este texto en Claude Code, abierto dentro de esta carpeta (`estudio_volvo`):

---

En esta carpeta hay un script `generar_estudio.py` que arma el PDF `Estudio_XC60_vs_Volvo_Electricos.pdf` (comparativo Volvo XC60 diésel vs Volvo eléctricos) y una carpeta `fotos/` vacía.

Tu tarea:

1. Instala lo necesario si falta: `pip install reportlab pillow`.
2. Busca en internet fotos oficiales (sitio de Volvo Cars o sala de prensa de Volvo: volvocars.com, media.volvocars.com o volvohomestore.cl) de estos modelos, una **exterior** y una **interior** de cada uno:
   - Volvo EX30
   - Volvo EX30 Cross Country
   - Volvo EX40
   - Volvo EC40
   - Volvo EX90
3. Descárgalas en buena resolución (mínimo 1200 px de ancho) y guárdalas en `fotos/` con estos nombres exactos (jpg o png):
   - `ex30_ext.jpg`, `ex30_int.jpg`
   - `ex30cc_ext.jpg`, `ex30cc_int.jpg`
   - `ex40_ext.jpg`, `ex40_int.jpg`
   - `ec40_ext.jpg`, `ec40_int.jpg`
   - `ex90_ext.jpg`, `ex90_int.jpg`
4. Abre cada imagen y verifica que sea el modelo correcto y la vista correcta (exterior / interior). Si alguna no corresponde, busca otra.
5. Ejecuta `python3 generar_estudio.py`.
6. Revisa el PDF generado: cada modelo debe tener su página con foto exterior e interior y ningún recuadro "Falta foto".

Nota: el EX30 Core y el EX30 Plus usan las mismas fotos (`ex30_*`), porque por fuera y por dentro son prácticamente iguales.
