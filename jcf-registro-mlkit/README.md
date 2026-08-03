# JCF Registro – Google ML Kit

Aplicación móvil para registrar padres/tutores y niños beneficiados por la Fundación JCF.

## Tecnología

- Google ML Kit Text Recognition v2, escritura latina.
- Procesamiento OCR dentro del dispositivo.
- Cámara y selección desde Fotos.
- La fotografía no se guarda en la aplicación.
- Los registros se guardan localmente en JSON.
- Copia en formato CSV para pegar en Excel o Numbers.

## Plataformas

- Android: el flujo de GitHub Actions genera un APK de prueba.
- iPhone: el mismo código funciona, pero Apple exige firma para instalarlo. Se puede probar desde Xcode con una cuenta gratuita; para TestFlight/App Store se necesita una membresía Apple Developer.

## Privacidad

No se incluyen ni se publican fotografías reales de cédulas en este repositorio.
