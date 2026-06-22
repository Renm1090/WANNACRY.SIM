#!/usr/bin/env python3
import random
import math
from PIL import Image, ImageDraw, ImageFilter

def create_cyber_background(width=1920, height=1080, filename="cyber_bg.png"):
    print(f"Generando textura de fondo estilo ciberseguridad en {filename}...")
    
    # Base oscura (azul oscuro/negro cyberpunk)
    base_color = (8, 9, 15)
    img = Image.new("RGBA", (width, height), base_color)
    draw = ImageDraw.Draw(img)
    
    # 1. Dibujar una rejilla tecnológica tenue
    grid_size = 60
    grid_color = (20, 25, 40, 45) # Muy transparente
    for x in range(0, width, grid_size):
        draw.line([(x, 0), (x, height)], fill=grid_color, width=1)
    for y in range(0, height, grid_size):
        draw.line([(0, y), (width, y)], fill=grid_color, width=1)
        
    # 2. Generar nodos y circuitos abstractos
    # Vamos a crear una capa de brillo (blur) y una capa nítida
    glow_layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_layer)
    
    sharp_layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    sharp_draw = ImageDraw.Draw(sharp_layer)
    
    # Colores Cyberpunk
    cyan_glow = (0, 229, 255, 60)
    cyan_sharp = (0, 229, 255, 180)
    green_glow = (0, 255, 102, 60)
    green_sharp = (0, 255, 102, 180)
    
    # Generar puntos de anclaje para los circuitos
    nodes = []
    for _ in range(35):
        nodes.append({
            "x": random.randint(50, width - 50),
            "y": random.randint(50, height - 50),
            "color_glow": random.choice([cyan_glow, green_glow]),
            "color_sharp": random.choice([cyan_sharp, green_sharp]),
            "size": random.randint(3, 8)
        })
        
    # Dibujar conexiones (líneas de circuito con ángulos de 45/90 grados)
    for i, node in enumerate(nodes):
        # Conectar con algunos nodos cercanos
        connected_count = 0
        for other in nodes[i+1:]:
            dist = math.hypot(node["x"] - other["x"], node["y"] - other["y"])
            if dist < 250 and connected_count < 2:
                # Dibujar línea en ángulo cyberpunk (horizontal/vertical -> diagonal -> etc)
                mid_x = (node["x"] + other["x"]) // 2
                mid_y = node["y"]
                
                # Capa de brillo
                glow_draw.line([(node["x"], node["y"]), (mid_x, mid_y), (other["x"], other["y"])], 
                               fill=node["color_glow"], width=4)
                # Capa nítida
                sharp_draw.line([(node["x"], node["y"]), (mid_x, mid_y), (other["x"], other["y"])], 
                                fill=node["color_sharp"], width=1)
                
                connected_count += 1
                
    # Dibujar los nodos (círculos)
    for node in nodes:
        x, y, r = node["x"], node["y"], node["size"]
        # Capa de brillo
        glow_draw.ellipse([x - r - 4, y - r - 4, x + r + 4, y + r + 4], fill=node["color_glow"])
        # Capa nítida
        sharp_draw.ellipse([x - r, y - r, x + r, y + r], fill=node["color_sharp"])
        # Centro vacío o más claro para efecto tecnológico
        sharp_draw.ellipse([x - r//2, y - r//2, x + r//2, y + r//2], fill=(255, 255, 255, 200))

    # Aplicar un filtro de desenfoque gaussiano a la capa de brillo
    glow_blurred = glow_layer.filter(ImageFilter.GaussianBlur(radius=6))
    
    # Combinar capas
    final_img = Image.alpha_composite(img, glow_blurred)
    final_img = Image.alpha_composite(final_img, sharp_layer)
    
    # Convertir a RGB antes de guardar como JPEG/PNG estándar si es necesario (RGBA es genial para PNG)
    final_img.convert("RGB").save(filename, "PNG")
    print(f"Completado. Archivo '{filename}' guardado con éxito.")

if __name__ == "__main__":
    create_cyber_background()
