from PIL import Image
import sys

def scan_profile(path, y_percent):
    try:
        img = Image.open(path).convert('L')
        w, h = img.size
        y = int(h * y_percent)
        print(f"Scanning profile for {path} at y={y} (W={w})")
        
        # Get pixels at row y
        pixels = []
        for x in range(w):
            pixels.append(img.getpixel((x, y)))
            
        # Compress output: average every 50 pixels
        chunk_size = 50
        profile = ""
        for i in range(0, w, chunk_size):
            chunk = pixels[i:i+chunk_size]
            avg = sum(chunk) / len(chunk)
            if avg < 20: char = "_"
            elif avg < 100: char = "."
            elif avg < 200: char = "="
            else: char = "#"
            profile += char
            
        print(f"Profile: |{profile}|")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    scan_profile("public/assets/smashup/cards/cards2.png", 0.35) # Row 2 approx
    scan_profile("public/assets/smashup/cards/cards2.png", 0.07) # Row 0 approx
    scan_profile("public/assets/smashup/cards/cards3.png", 0.78) # Row 5 approx
