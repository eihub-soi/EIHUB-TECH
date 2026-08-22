import marshal
import dis

def extract_strings_from_pyc(filepath):
    # Pyc files usually have a 16 byte header in Python 3.7+ (magic, bitfield, timestamp, size)
    with open(filepath, 'rb') as f:
        magic = f.read(4)
        bitfield = f.read(4)
        timestamp = f.read(4)
        size = f.read(4)
        code = marshal.load(f)  # nosec B302 nosemgrep

    def extract_strings(c):
        strings = []
        if hasattr(c, 'co_consts'):
            for const in c.co_consts:
                if isinstance(const, str):
                    strings.append(const)
                elif hasattr(const, 'co_code'):
                    strings.extend(extract_strings(const))
        return strings

    for s in extract_strings(code):
        if len(s) > 20 and "SELECT" in s or "UPDATE" in s or "INSERT" in s or "api/" in s:
            print(f"STRING: {repr(s)}")

extract_strings_from_pyc('backend/__pycache__/app.cpython-313.pyc')
