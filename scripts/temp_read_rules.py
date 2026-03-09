#!/usr/bin/env python3
"""
读取卡迪亚规则图片并提取文字内容
"""
import os
from PIL import Image

# 检查是否安装了 pytesseract
try:
    import pytesseract
    HAS_OCR = True
except ImportError:
    HAS_OCR = False
    print("警告: 未安装 pytesseract，将只输出图片基本信息")
    print("如需 OCR 功能，请运行: pip3 install pytesseract")

rules_dir = "public/assets/cardia/rules/compressed"

if not os.path.exists(rules_dir):
    print(f"错误: 目录不存在 {rules_dir}")
    exit(1)

# 获取所有规则图片
rule_files = sorted([f for f in os.listdir(rules_dir) if f.startswith('rule_page_') and f.endswith('.webp')])

print(f"找到 {len(rule_files)} 个规则页面\n")
print("=" * 80)

for i, filename in enumerate(rule_files, 1):
    filepath = os.path.join(rules_dir, filename)
    print(f"\n第 {i} 页: {filename}")
    print("-" * 80)
    
    try:
        img = Image.open(filepath)
        print(f"图片尺寸: {img.size[0]}x{img.size[1]}")
        print(f"图片模式: {img.mode}")
        
        if HAS_OCR:
            print("\n正在提取文字...")
            # 使用 pytesseract 提取文字
            text = pytesseract.image_to_string(img, lang='eng+chi_sim')
            
            # 清理和格式化文字
            lines = [line.strip() for line in text.split('\n') if line.strip()]
            
            if lines:
                print("\n提取的文字内容:")
                for line in lines[:50]:  # 只显示前50行
                    print(f"  {line}")
                if len(lines) > 50:
                    print(f"  ... (还有 {len(lines) - 50} 行)")
            else:
                print("  (未提取到文字)")
        
    except Exception as e:
        print(f"错误: {e}")
    
    print("=" * 80)

print("\n\n提示: 如果需要更准确的 OCR 结果，请确保:")
print("1. 已安装 pytesseract: pip3 install pytesseract")
print("2. 已安装 Tesseract OCR 引擎")
print("   - macOS: brew install tesseract tesseract-lang")
print("   - Ubuntu: sudo apt-get install tesseract-ocr tesseract-ocr-chi-sim")
