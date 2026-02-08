from PIL import Image
import sys

def analyze_grid(files):
    output = []
    
    for entry in files:
        path, r, c = entry
        try:
            img = Image.open(path).convert('L')
            w, h = img.size
            cell_w = w // c
            cell_h = h // r
            
            output.append(f"\nScanning {path} ({w}x{h}) as {r}x{c}")
            output.append(f"Cell size: {cell_w}x{cell_h}")
            
            grid = []
            for rr in range(r):
                row_items = []
                for cc in range(c):
                    idx = rr * c + cc
                    x = cc * cell_w
                    y = rr * cell_h
                    box = (x + 100, y + 100, x + cell_w - 100, y + cell_h - 100)
                    region = img.crop(box)
                    data = list(region.getdata())
                    avg = sum(data) / len(data) if data else 0
                    
                    mark = "##" if avg < 15 else f"{idx:02}"
                    row_items.append(mark)
                grid.append(" ".join(row_items))
            output.extend(grid)
            
        except Exception as e:
            output.append(f"Error scanning {path}: {str(e)}")

    with open("scan_results.txt", "w") as f:
        f.write("\n".join(output))
    print("Results saved to scan_results.txt")

if __name__ == "__main__":
    files = [
        ("public/assets/smashup/cards/compressed/cards2.webp", 7, 7),
        ("public/assets/smashup/cards/compressed/cards3.webp", 7, 8),
        ("public/assets/smashup/cards/compressed/cards4.webp", 7, 8)
    ]
    analyze_grid(files)
