#!/usr/bin/env python3
"""
快速读取卡迪亚规则图片（只处理前3页）
"""
import os
from PIL import Image
import pytesseract

rules_dir = "public/assets/cardia/rules/compressed"
rule_files = sorted([f for f in os.listdir(rules_dir) if f.startswith('rule_page_') and f.endswith('.webp')])[:3]

print(f"处理前 {len(rule_files)} 页规则\n")

for i, filename in enumerate(rule_files, 1):
    filepath = os.path.join(rules_dir, filename)
    print(f"=== 第 {i} 页: {filename} ===\n")
    
    try:
        img = Image.open(filepath)
        # 只提取英文（更快）
        text = pytesseract.image_to_string(img, lang='eng')
        lines = [line.strip() for line in text.split('\n') if line.strip() and len(line.strip()) > 2]
        
        for line in lines[:30]:  # 只显示前30行
            print(line)
        
        print(f"\n(共 {len(lines)} 行)\n")
        
    except Exception as e:
        print(f"错误: {e}\n")
