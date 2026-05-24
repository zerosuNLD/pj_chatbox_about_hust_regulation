import sys

def fix_indent():
    with open("c:\\Users\\Admin\\Desktop\\test\\backend\\server.py", "r", encoding="utf-8") as f:
        lines = f.readlines()

    # Lines 125 to 255 need an extra 4 spaces
    # In 0-indexed, that's lines[124] to lines[254]
    for i in range(124, 255):
        if lines[i].strip() != "":
            lines[i] = "    " + lines[i]

    with open("c:\\Users\\Admin\\Desktop\\test\\backend\\server.py", "w", encoding="utf-8") as f:
        f.writelines(lines)

if __name__ == "__main__":
    fix_indent()
