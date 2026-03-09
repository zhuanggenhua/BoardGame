#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
临时脚本：提取 Cardia II 牌组剩余卡牌数据
"""

import os
from PIL import Image
import pytesseract

# 配置 Tesseract 路径（macOS Homebrew 安装）
pytesseract.pytesseract.tesseract_cmd = '/opt/homebrew/bin/tesseract'

# 卡牌图片路径
card_images = [
    ('27.webp', 12),  # II 牌组卡牌 12
    ('28.webp', 13),  # II 牌组卡牌 13
    ('29.webp', 14),  # II 牌组卡牌 14
    ('30.webp', 15),  # II 牌组卡牌 15
    ('31.webp', 16),  # II 牌组卡牌 16
]

base_path = 'public/assets/cardia/cards/compressed'

print("=" * 80)
print("Cardia II 牌组卡牌数据提取")
print("=" * 80)
print()

for filename, card_num in card_images:
    filepath = os.path.join(base_path, filename)
    
    if not os.path.exists(filepath):
        print(f"❌ 文件不存在: {filepath}")
        continue
    
    print(f"📄 处理卡牌 {card_num}: {filename}")
    print("-" * 80)
    
    try:
        # 打开图片
        img = Image.open(filepath)
        
        # 获取图片尺寸
        width, height = img.size
        print(f"   图片尺寸: {width}x{height}")
        
        # 使用 OCR 提取文本（中文+英文）
        text = pytesseract.image_to_string(img, lang='chi_sim+eng')
        
        print(f"   提取的文本:")
        print("   " + "-" * 76)
        for line in text.strip().split('\n'):
            if line.strip():
                print(f"   {line}")
        print("   " + "-" * 76)
        print()
        
    except Exception as e:
        print(f"   ❌ 错误: {e}")
        print()

print("=" * 80)
print("提取完成")
print("=" * 80)
