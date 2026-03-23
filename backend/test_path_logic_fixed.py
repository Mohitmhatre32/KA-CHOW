import os

def test_save_logic_fixed(file_path):
    cwd = os.path.abspath(os.getcwd())
    abs_path = os.path.abspath(file_path)
    
    # Normpath to handle mixed slashes in Windows/Linux interop
    abs_path = os.path.normpath(abs_path)
    storage_dir = os.path.abspath(os.path.join(cwd, "storage"))
    
    # NEW FIXED LOGIC
    is_safe = os.path.normcase(abs_path).startswith(os.path.normcase(cwd)) or \
              os.path.normcase(abs_path).startswith(os.path.normcase(storage_dir))
    
    print(f"CWD: {cwd}")
    print(f"File Path Input: {file_path}")
    print(f"Abs Path: {abs_path}")
    print(f"Is Safe: {is_safe}")
    return is_safe

print("--- Test 1: Exact match ---")
assert test_save_logic_fixed("storage/repos/test.txt") == True

print("\n--- Test 2: Different case drive letter ---")
cwd = os.getcwd()
if cwd.startswith("c:"):
    alt_path = cwd.replace("c:", "C:") + "\\storage\\repos\\test.txt"
    assert test_save_logic_fixed(alt_path) == True
elif cwd.startswith("C:"):
    alt_path = cwd.replace("C:", "c:") + "\\storage\\repos\\test.txt"
    assert test_save_logic_fixed(alt_path) == True

print("\n--- Test 3: Unsafe path ---")
assert test_save_logic_fixed("C:/Windows/system32/config") == False

print("\n✅ All tests passed!")
