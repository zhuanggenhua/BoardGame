const QidahenThumbnail = () => (
    <div className="relative h-full w-full overflow-hidden bg-[#1a130c]">
        <img
            src="/assets/qidahen/thumbnails/compressed/cover.webp"
            alt="七大恨"
            className="h-full w-full object-cover"
            draggable={false}
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3">
            <div className="text-xl font-black tracking-[0.18em] text-[#f0d59a]">七大恨</div>
        </div>
    </div>
);

export default QidahenThumbnail;
