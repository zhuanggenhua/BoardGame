/// <reference lib="webworker" />

type EncodeRequest = { bitmap: ImageBitmap; maxWidth: number; maxHeight: number; quality: number };

self.onmessage = async (event: MessageEvent<EncodeRequest>) => {
    const { bitmap, maxWidth, maxHeight, quality } = event.data;
    try {
        const ratio = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
        const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * ratio)), Math.max(1, Math.round(bitmap.height * ratio)));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('截图画布不可用');
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
        self.postMessage({ dataUrl: new FileReaderSync().readAsDataURL(blob) });
    } catch (error) {
        self.postMessage({ error: String(error) });
    } finally {
        bitmap.close();
    }
};
