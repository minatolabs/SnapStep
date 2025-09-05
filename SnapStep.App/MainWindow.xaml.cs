using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.WindowsRuntime;
using System.Timers;
using Windows.Storage.Pickers;
using Microsoft.UI.Windowing;
using WinRT.Interop;
using Windows.Graphics;

// GDI capture & drawing
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Drawing2D;
using DrawingImage = System.Drawing.Image;

namespace SnapStep.App;

public sealed partial class MainWindow : Window
{
    private string? _sessionId;
    private LocalServer? _server;

    // Shared data folder (same one the in-process server serves as /sessions)
    private string SessionsRoot => Path.Combine(Path.GetTempPath(), "SnapStep", "sessions");

    public MainWindow()
    {
        InitializeComponent();
        Directory.CreateDirectory(SessionsRoot);

        // Window size and icon
        var hwnd = WindowNative.GetWindowHandle(this);
        var winId = Microsoft.UI.Win32Interop.GetWindowIdFromWindow(hwnd);
        var aw = AppWindow.GetFromWindowId(winId);
        aw?.Resize(new SizeInt32(420, 280));
        aw?.SetIcon("Assets/appicon.ico"); // (spellchecker may warn; it's fine)

        // Start the embedded ASP.NET Core server
        _ = StartLocalServerAsync();

        // Ensure hooks/server are cleaned up
        this.Closed += async (_, __) =>
        {
            StopMouseHook();
            if (_server is not null) await _server.DisposeAsync();
        };
    }

    private async System.Threading.Tasks.Task StartLocalServerAsync()
    {
        // LocalServer.StartAsync is static and returns a LocalServer instance
        _server = await LocalServer.StartAsync(
            url: "http://127.0.0.1:5173",
            sessionsRoot: SessionsRoot,
            contentRoot: AppContext.BaseDirectory);
    }

    private void BtnSettings_Click(object sender, RoutedEventArgs e)
    {
        _ = new ContentDialog
        {
            Title = "Settings (stub)",
            Content = $"Shared path:\n{SessionsRoot}\n\nSingle-click = instant capture.\nDouble-click = one capture with two concentric rings.",
            CloseButtonText = "Close",
            XamlRoot = this.Content.XamlRoot
        }.ShowAsync();
    }

    private void BtnStart_Click(object sender, RoutedEventArgs e)
    {
        _sessionId = Guid.NewGuid().ToString("N");
        Directory.CreateDirectory(Path.Combine(SessionsRoot, _sessionId));
        SessionLabel.Text = $"Session: {_sessionId}";

        BtnImport.IsEnabled = true;
        BtnComplete.IsEnabled = true;
        BtnPause.IsEnabled = true;

        _isPaused = false;
        StartMouseHook();
    }

    private void BtnPause_Click(object sender, RoutedEventArgs e)
    {
        _isPaused = !_isPaused;
        BtnPause.Content = _isPaused ? "Resume Capture" : "Pause Capture";
        if (_isPaused) StopMouseHook(); else StartMouseHook();
    }

    private async void BtnImport_Click(object sender, RoutedEventArgs e)
    {
        if (_sessionId == null) return;

        var hWnd = WindowNative.GetWindowHandle(this);
        var picker = new FileOpenPicker();
        picker.FileTypeFilter.Add(".png");
        picker.FileTypeFilter.Add(".jpg");
        picker.FileTypeFilter.Add(".jpeg");
        picker.FileTypeFilter.Add(".bmp");
        picker.SuggestedStartLocation = PickerLocationId.PicturesLibrary;
        InitializeWithWindow.Initialize(picker, hWnd);

        var files = await picker.PickMultipleFilesAsync();
        if (files is null || files.Count == 0) return;

        var folder = Path.Combine(SessionsRoot, _sessionId);
        int nextIndex = Directory.GetFiles(folder, "capture_*.png").Length + 1;

        foreach (var f in files)
        {
            using var src = await f.OpenReadAsync();
            using var fs = File.Create(Path.Combine(folder, $"capture_{nextIndex:0000}.png"));
            await src.AsStreamForRead().CopyToAsync(fs);
            nextIndex++;
        }
    }

    private void BtnComplete_Click(object sender, RoutedEventArgs e)
    {
        if (_sessionId == null) return;
        StopMouseHook();

        var url = $"http://127.0.0.1:5173/session/{_sessionId}";
        try
        {
            Process.Start(new ProcessStartInfo { FileName = url, UseShellExecute = true });
        }
        catch (Exception ex)
        {
            _ = new ContentDialog
            {
                Title = "Open Editor Failed",
                Content = ex.Message,
                CloseButtonText = "Close",
                XamlRoot = this.Content.XamlRoot
            }.ShowAsync();
        }
    }

    // ----------------- Low-level mouse hook -----------------

    private bool _isPaused = false;
    private IntPtr _mouseHook = IntPtr.Zero;
    private LowLevelMouseProc? _mouseProc;

    private const int WH_MOUSE_LL = 14;
    private const int WM_LBUTTONDOWN = 0x0201;

    private delegate IntPtr LowLevelMouseProc(int nCode, IntPtr wParam, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    private struct POINT { public int X; public int Y; }

    [DllImport("user32.dll")] private static extern bool GetCursorPos(out POINT lpPoint);
    [DllImport("user32.dll")] private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelMouseProc lpfn, IntPtr hMod, uint dwThreadId);
    [DllImport("user32.dll")] private static extern bool UnhookWindowsHookEx(IntPtr hhk);
    [DllImport("user32.dll")] private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);
    [DllImport("kernel32.dll")] private static extern IntPtr GetModuleHandle(string? lpModuleName);

    // Primary screen metrics (so we don't need System.Windows.Forms.Screen)
    [DllImport("user32.dll")] private static extern int GetSystemMetrics(int nIndex);
    private const int SM_CXSCREEN = 0;
    private const int SM_CYSCREEN = 1;

    // Cursor hotspot info
    [StructLayout(LayoutKind.Sequential)]
    private struct ICONINFO
    {
        public bool fIcon;
        public int xHotspot;
        public int yHotspot;
        public IntPtr hbmMask;
        public IntPtr hbmColor;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool GetIconInfo(IntPtr hIcon, out ICONINFO piconinfo);

    [DllImport("gdi32.dll")]
    private static extern bool DeleteObject(IntPtr hObject);

    // Per-monitor bounds (handles negative coordinates & mixed DPI)
    [DllImport("user32.dll")] private static extern IntPtr MonitorFromPoint(POINT pt, uint dwFlags);
    private const uint MONITOR_DEFAULTTONEAREST = 2;
    [StructLayout(LayoutKind.Sequential)] private struct RECT { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)]
    private struct MONITORINFO
    {
        public int cbSize;
        public RECT rcMonitor;
        public RECT rcWork;
        public uint dwFlags;
    }
    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO lpmi);

    [DllImport("user32.dll")] private static extern uint GetDoubleClickTime();

    // Cursor info to draw the actual Windows pointer
    [StructLayout(LayoutKind.Sequential)]
    private struct CURSORINFO
    {
        public int cbSize;
        public int flags;
        public IntPtr hCursor;
        public POINT ptScreenPos;
    }
    [DllImport("user32.dll")] private static extern bool GetCursorInfo(out CURSORINFO pci);
    private const int CURSOR_SHOWING = 0x00000001;

    private void StartMouseHook()
    {
        if (_mouseHook != IntPtr.Zero) return;
        _mouseProc = HookCallback;
        using var proc = Process.GetCurrentProcess();
        using var mod = proc.MainModule!;
        _mouseHook = SetWindowsHookEx(WH_MOUSE_LL, _mouseProc, GetModuleHandle(mod.ModuleName), 0);
    }

    private void StopMouseHook()
    {
        if (_mouseHook == IntPtr.Zero) return;
        UnhookWindowsHookEx(_mouseHook);
        _mouseHook = IntPtr.Zero;

        _dblTimer?.Stop();
        _dblTimer?.Dispose();
        _dblTimer = null;
        _last = default;
    }

    // ----- capture immediately; add 2 concentric circles if second click arrives -----

    private System.Timers.Timer? _dblTimer;
    private record struct LastCapture(string Path, int Left, int Top, int W, int H, int Cx, int Cy, int R);
    private LastCapture? _last;

    private IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0 && wParam == (IntPtr)WM_LBUTTONDOWN && !_isPaused && _sessionId != null)
        {
            if (GetCursorPos(out var pt))
            {
                if (_dblTimer == null)
                {
                    // FIRST CLICK: capture immediately
                    _last = CaptureAndSave(pt.X, pt.Y);

                    // Arm a timer window for a potential double-click
                    _dblTimer = new System.Timers.Timer(Math.Max(50, GetDoubleClickTime() - 10));
                    _dblTimer.AutoReset = false;
                    _dblTimer.Elapsed += (_, __) => { _last = null; _dblTimer?.Dispose(); _dblTimer = null; };
                    _dblTimer.Start();
                }
                else
                {
                    // SECOND CLICK within window: draw concentric circles on the last image
                    _dblTimer.Stop();
                    _dblTimer.Dispose();
                    _dblTimer = null;

                    if (_last.HasValue) AddSecondCircleToLast(_last.Value);
                    _last = null;
                }
            }
        }
        return CallNextHookEx(_mouseHook, nCode, wParam, lParam);
    }

    // Returns metadata we need in case a second click arrives
    private LastCapture CaptureAndSave(int x, int y)
    {
        var (left, top, w, h) = ComputeBoxOnClickedMonitor(x, y);

        using var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(bmp))
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.CopyFromScreen(left, top, 0, 0, new System.Drawing.Size(w, h), CopyPixelOperation.SourceCopy);

            // Cursor + hotspot so the tip sits at the center
            var (cursorIcon, hotX, hotY) = TryGetCursorIconWithHotspot();
            int baseLen = cursorIcon != null ? Math.Max(cursorIcon.Width, cursorIcon.Height) : 16;

            int cx = x - left, cy = y - top;

            // Base radius, then reduce by 1/3 → 2/3 of original
            int r0 = Math.Min(3 * baseLen, (int)(Math.Min(w, h) * 0.45));
            int r = Math.Max(6, (int)Math.Round(r0 * (2.0 / 3.0)));

            // Single click ring: thickness 6 px, color #f38c1a
            using var pen = new Pen(System.Drawing.Color.FromArgb(0xF3, 0x8C, 0x1A), 6f);
            g.DrawEllipse(pen, cx - r, cy - r, 2 * r, 2 * r);

            // Single pointer (tip centered)
            if (cursorIcon != null)
            {
                g.DrawIcon(cursorIcon, cx - hotX, cy - hotY);
            }

            var folder = Path.Combine(SessionsRoot, _sessionId!);
            Directory.CreateDirectory(folder);
            int nextIndex = Directory.GetFiles(folder, "capture_*.png").Length + 1;
            var path = Path.Combine(folder, $"capture_{nextIndex:0000}.png");
            bmp.Save(path, ImageFormat.Png);

            return new LastCapture(path, left, top, w, h, cx, cy, r);
        }
    }

    private (int left, int top, int w, int h) ComputeBoxOnClickedMonitor(int x, int y)
    {
        var mon = MonitorFromPoint(new POINT { X = x, Y = y }, MONITOR_DEFAULTTONEAREST);
        var mi = new MONITORINFO { cbSize = Marshal.SizeOf<MONITORINFO>() };
        if (!GetMonitorInfo(mon, ref mi))
        {
            // Fallback: primary screen half
            int sw = GetSystemMetrics(SM_CXSCREEN);
            int sh = GetSystemMetrics(SM_CYSCREEN);
            int fw = Math.Max(200, sw / 2);
            int fh = Math.Max(200, sh / 2);
            int left0 = Math.Clamp(x - fw / 2, 0, sw - fw);
            int top0 = Math.Clamp(y - fh / 2, 0, sh - fh);
            return (left0, top0, fw, fh);
        }

        int mLeft = mi.rcMonitor.Left, mTop = mi.rcMonitor.Top;
        int mW = mi.rcMonitor.Right - mi.rcMonitor.Left;
        int mH = mi.rcMonitor.Bottom - mi.rcMonitor.Top;

        int w = Math.Max(200, mW / 2);
        int h = Math.Max(200, mH / 2);

        int left = Math.Clamp(x - w / 2, mLeft, mLeft + mW - w);
        int top = Math.Clamp(y - h / 2, mTop, mTop + mH - h);
        return (left, top, w, h);
    }

    private void AddSecondCircleToLast(LastCapture last)
    {
        using var bmp = new Bitmap(last.W, last.H, PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(bmp))
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.CopyFromScreen(last.Left, last.Top, 0, 0,
                new System.Drawing.Size(last.W, last.H), CopyPixelOperation.SourceCopy);

            var color = System.Drawing.Color.FromArgb(0xF3, 0x8C, 0x1A);

            // BOTH rings 3 px; 1 px gap between their edges:
            // Inner-edge(outer) = r - 1.5
            // Outer-edge(inner) = r2 + 1.5 = (r - 1.5) - 1  => r2 = r - 4
            int r = last.R;
            int r2 = Math.Max(2, r - 4);

            using var penOuter = new Pen(color, 3f);
            using var penInner = new Pen(color, 3f);
            g.DrawEllipse(penOuter, last.Cx - r, last.Cy - r, 2 * r, 2 * r);
            g.DrawEllipse(penInner, last.Cx - r2, last.Cy - r2, 2 * r2, 2 * r2);

            // Single pointer (tip centered)
            var (icon, hotX, hotY) = TryGetCursorIconWithHotspot();
            if (icon != null)
            {
                g.DrawIcon(icon, last.Cx - hotX, last.Cy - hotY);
            }
        }

        try
        {
            bmp.Save(last.Path, ImageFormat.Png);
        }
        catch (ExternalException)
        {
            string tmp = last.Path + ".tmp";
            bmp.Save(tmp, ImageFormat.Png);
            File.Copy(tmp, last.Path, overwrite: true);
            File.Delete(tmp);
        }
    }

    private Icon? TryGetCursorIcon()
    {
        try
        {
            var ci = new CURSORINFO { cbSize = Marshal.SizeOf<CURSORINFO>() };
            if (GetCursorInfo(out ci) && (ci.flags & CURSOR_SHOWING) != 0 && ci.hCursor != IntPtr.Zero)
                return Icon.FromHandle(ci.hCursor);
        }
        catch { }
        return null;
    }

    private (Icon? icon, int hotX, int hotY) TryGetCursorIconWithHotspot()
    {
        try
        {
            var ci = new CURSORINFO { cbSize = Marshal.SizeOf<CURSORINFO>() };
            if (GetCursorInfo(out ci) && (ci.flags & CURSOR_SHOWING) != 0 && ci.hCursor != IntPtr.Zero)
            {
                int hx = 0, hy = 0;
                if (GetIconInfo(ci.hCursor, out var info))
                {
                    // For cursors, fIcon==false; x/yHotspot are valid
                    hx = info.xHotspot; hy = info.yHotspot;
                    if (info.hbmMask != IntPtr.Zero) DeleteObject(info.hbmMask);
                    if (info.hbmColor != IntPtr.Zero) DeleteObject(info.hbmColor);
                }
                return (Icon.FromHandle(ci.hCursor), hx, hy);
            }
        }
        catch { }
        return (null, 0, 0);
    }
}
