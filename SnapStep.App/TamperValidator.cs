using System;
using System.IO;
using System.Security.Cryptography;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace SnapStep.App
{
    internal static class TamperValidator
    {
        public static void Verify(IHostEnvironment env, ILogger logger)
        {
            if (TamperInfo.Files is null || TamperInfo.Files.Length == 0)
                return;

            foreach (var (rel, expected) in TamperInfo.Files)
            {
                var path = Path.Combine(
                    env.ContentRootPath,
                    rel.Replace('/', Path.DirectorySeparatorChar));

                if (!File.Exists(path))
                {
                    logger.LogCritical("Integrity check failed (missing): {File}", rel);
                    throw new InvalidOperationException($"Missing critical asset: {rel}");
                }

                using var s = File.OpenRead(path);
                using var sha = SHA256.Create();
                var actual = Convert.ToHexString(sha.ComputeHash(s));

                if (!actual.Equals(expected, StringComparison.OrdinalIgnoreCase))
                {
                    logger.LogCritical("Integrity check failed (modified): {File}", rel);
                    throw new InvalidOperationException($"Modified critical asset: {rel}");
                }
            }
        }
    }
}
