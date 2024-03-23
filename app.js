const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
const captureButton = document.getElementById('capture');

navigator.mediaDevices.getUserMedia({ video: true })
    .then((stream) => {
        video.srcObject = stream;
    });

captureButton.addEventListener('click', () => {
    // Ajusta el tamaño del canvas al de la captura de video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Dibuja la imagen del video en el canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convierte la imagen del canvas a un archivo blob
    canvas.toBlob((blob) => {
        // Crea un nuevo nombre de archivo basado en la fecha y hora actual
        const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
        const filename = `foto_${timestamp}.png`;

        // Crea un enlace para descargar la imagen
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();

        // Limpia el enlace y el objeto URL
        URL.revokeObjectURL(link.href);
    }, 'image/png');
});