# VHS Demo for opencode-direnv
# Run: nix-shell -p vhs ffmpeg opencode --run "vhs demo.tape"

Output demo.gif

Set Shell "bash"
Set FontSize 16
Set Width 960
Set Height 720
Set Theme "tokyonight"
Set Padding 20
Set TypingSpeed 75ms

# Show .envrc
Type "cat .envrc"
Enter
Sleep 2s

# Setup alias for opencode (hidden)
Type "echo $API_URL"
Enter
Sleep 2s
Type "node -v"
Enter
Sleep 2s
Show

# Start opencode
Type "opencode"
Enter
Sleep 2s

# Check if direnv is loaded
Type "echo $API_URL"
Enter
Sleep 7s
Type "node -v"
Enter
Sleep 7s
