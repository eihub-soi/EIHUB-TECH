import os
from PIL import Image

def generate_icons():
    source_image_path = "public/logo.png"
    output_dir = "public/pwa-icons"
    sizes = [72, 96, 128, 144, 152, 192, 384, 512]

    if not os.path.exists(source_image_path):
        print(f"Error: {source_image_path} not found.")
        return

    os.makedirs(output_dir, exist_ok=True)

    try:
        with Image.open(source_image_path) as img:
            # Convert to RGBA to preserve transparency if any
            img = img.convert("RGBA")
            
            for size in sizes:
                resized_img = img.resize((size, size), Image.Resampling.LANCZOS)
                output_path = os.path.join(output_dir, f"manifest-icon-{size}.maskable.png")
                resized_img.save(output_path, "PNG")
                print(f"Generated {output_path}")

    except Exception as e:
        print(f"Error generating icons: {e}")

if __name__ == "__main__":
    generate_icons()
