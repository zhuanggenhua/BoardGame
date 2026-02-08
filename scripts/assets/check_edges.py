from PIL import Image
import sys

def check_edges(path, y_ratio, desc):
    try:
        img = Image.open(path).convert('L')
        w, h = img.size
        y = int(h * y_ratio)
        
        # Check first 50 pixels
        left_vals = [img.getpixel((x, y)) for x in range(50)]
        left_avg = sum(left_vals)/50
        
        # Check last 50 pixels
        right_vals = [img.getpixel((x, y)) for x in range(w-50, w)]
        right_avg = sum(right_vals)/50
        
        print(f"{desc}: LeftAvg={left_avg:.1f}, RightAvg={right_avg:.1f} (W={w}, Y={y})")
        
    except Exception as e:
        print(f"Error {path}: {e}")

if __name__ == "__main__":
    # cards2: Row 0 (Miskatonic), Row 2 (Cthulhu)
    check_edges("public/assets/smashup/cards/cards2.png", 0.07, "Cards2 Row0")
    check_edges("public/assets/smashup/cards/cards2.png", 0.35, "Cards2 Row2")
    
    # cards3: Row 5 (Killer Plants)
    check_edges("public/assets/smashup/cards/cards3.png", 0.78, "Cards3 Row5")
