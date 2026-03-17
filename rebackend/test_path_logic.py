import os

def test_save_logic(file_path):
    cwd = os.path.abspath(os.getcwd())
    abs_path = os.path.abspath(file_path)
    
    # Normpath to handle mixed slashes in Windows/Linux interop
    abs_path = os.path.normpath(abs_path)
    storage_dir = os.path.abspath(os.path.join(cwd, "storage"))
    
    is_safe = abs_path.startswith(cwd) or abs_path.startswith(storage_dir)
    
    print(f"CWD: {cwd}")
    print(f"File Path Input: {file_path}")
    print(f"Abs Path: {abs_path}")
    print(f"Storage Dir: {storage_dir}")
    print(f"Is Safe: {is_safe}")
    
    # Case sensitivity check on Windows
    cwd_lower = cwd.lower()
    abs_path_lower = abs_path.lower()
    is_safe_lower = abs_path_lower.startswith(cwd_lower)
    print(f"Is Safe (Lower): {is_safe_lower}")

print("--- Test 1: Exact match ---")
test_save_logic("storage/repos/test.txt")

print("\n--- Test 2: Different case drive letter ---")
# Simulating a path from frontend that might have 'C:' instead of 'c:'
cwd = os.getcwd()
if cwd.startswith("c:"):
    alt_path = cwd.replace("c:", "C:") + "\\storage\\repos\\test.txt"
    test_save_logic(alt_path)
elif cwd.startswith("C:"):
    alt_path = cwd.replace("C:", "c:") + "\\storage\\repos\\test.txt"
    test_save_logic(alt_path)
