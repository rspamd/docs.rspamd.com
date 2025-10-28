---
title: Building Rspamd from source
---

# Building Rspamd from Source

This guide explains how to build Rspamd from source code using CMake. Follow these steps to compile and install Rspamd on your system.

## Prerequisites

Before you begin, ensure you have the following dependencies installed:

- **Git**: For cloning the Rspamd repository.
- **CMake**: Required for building the project.
- **OpenSSL**: Used for cryptographic operations. You can specify its location using `OPENSSL_ROOT_DIR`.
- **ICU**: International Components for Unicode, used for Unicode support. Specify its location using `ICU_ROOT_DIR`.
- **PCRE2**: Perl Compatible Regular Expressions library, used for pattern matching.
- **Hyperscan**: A high-performance multiple regex matching library. Enable it with `ENABLE_HYPERSCAN=ON`.
- **LuaJIT**: A Just-In-Time Compiler for Lua, used for scripting. Enable it with `ENABLE_LUAJIT=ON`.
- **Address Sanitizer**: For debugging purposes, enabled with `-DSANITIZE="address"`.
- **Additional Dependencies**:
  - **file-devel**: Development files for the file command.
  - **glib2-devel**: Development files for GLib.
  - **lapack-devel**: Development files for LAPACK.
  - **libicu-devel**: Development files for ICU.
  - **libsodium-devel**: Development files for libsodium.
  - **libunwind-devel**: Development files for libunwind.
  - **openblas-devel**: Development files for OpenBLAS.
  - **openssl-devel**: Development files for OpenSSL.
  - **pcre2-devel**: Development files for PCRE2.
  - **ragel**: A state machine compiler.
  - **sqlite-devel**: Development files for SQLite.
  - **systemd**: System and service manager.
  - **binutils-devel**: Development files for binutils.

## Steps to Build Rspamd

1. **Clone the Rspamd Repository**

   ```bash
   git clone https://github.com/rspamd/rspamd
   ```

2. **Create a Build Directory**

   ```bash
   mkdir rspamd-build/
   cd rspamd-build/
   ```

3. **Configure the Build with CMake**

   Run the following command to configure the build with the specified options:

   ### For Mac OS

   ```bash
   cmake ../rspamd -DENABLE_HYPERSCAN=ON -DOPENSSL_ROOT_DIR=/usr/local/opt/openssl -DENABLE_LUAJIT=ON -DICU_ROOT_DIR=/usr/local/opt/icu4c/ -DENABLE_PCRE2=ON -DENABLE_FULL_DEBUG=ON -DENABLE_FAST_MATH=ON -DSANITIZE="address"
   ```

   ### For Linux/BSD

   ```bash
   cmake ../rspamd -DENABLE_HYPERSCAN=ON -DOPENSSL_ROOT_DIR=/usr/local/opt/openssl -DENABLE_LUAJIT=ON -DICU_ROOT_DIR=/usr/local/opt/icu4c/ -DENABLE_PCRE2=ON -DENABLE_FULL_DEBUG=ON -DENABLE_FAST_MATH=ON -DSANITIZE="address"
   ```

   - `-DENABLE_HYPERSCAN=ON`: Enables Hyperscan for regex matching.
   - `-DOPENSSL_ROOT_DIR=/usr/local/opt/openssl`: Specifies the OpenSSL installation directory.
   - `-DENABLE_LUAJIT=ON`: Enables LuaJIT for scripting.
   - `-DICU_ROOT_DIR=/usr/local/opt/icu4c/`: Specifies the ICU installation directory.
   - `-DENABLE_PCRE2=ON`: Enables PCRE2 for pattern matching.
   - `-DENABLE_FULL_DEBUG=ON`: Enables full debug information.
   - `-DENABLE_FAST_MATH=ON`: Enables fast math compiler flags.
   - `-DSANITIZE="address"`: Enables Address Sanitizer for detecting memory errors.

   ### Compiler Flags

   You can use various compiler flags to customize the build process. Here are some common flags:

   - `-g`: Generates debug information.
   - `-O0`: Disables optimization, useful for debugging.
   - `-fno-omit-frame-pointer`: Prevents the compiler from omitting the frame pointer, which is useful for debugging.

   ### Toolset

   The `Toolset.cmake` file contains various options and settings for the build process:

   - **Build Options**:
     - `ENABLE_FAST_MATH`: Enables fast math compiler flags.
     - `ENABLE_STATIC_LIBCXX`: Enables static C++ library.
     - `ENABLE_COMPILE_TIME`: Shows compile time.
     - `ENABLE_LIBCXX`: Uses libc++ instead of libstdc++.

   - **Compiler Settings**:
     - Minimum versions for GCC and Clang are set.
     - Settings for optimization and debugging, including flags for different build types (Debug, Release, Coverage).

   - **Linker Settings**:
     - Option to choose the linker (lld, gold, ld) based on the compiler and sanitizer presence.

   - **Static Build**:
     - Option `ENABLE_STATIC` for static compilation, which may affect licensing.

   ### Sanitizer

   The `Sanitizer.cmake` file configures various sanitizers for debugging and error detection:

   - **Sanitizer Options**:
     - `SANITIZE`: A comma-separated list of sanitizers to enable. Available options include:
       - `address`: Enables Address Sanitizer (ASan) for detecting memory errors.
       - `leak`: Enables Leak Sanitizer (LSan) for detecting memory leaks.
       - `memory`: Enables Memory Sanitizer (MSan) for detecting uninitialized memory reads.
       - `undefined`: Enables Undefined Behavior Sanitizer (UBSan) for detecting undefined behavior.

   - **Optimization Level**:
     - The optimization level is set based on the compiler and debug settings. For example, if `ENABLE_FULL_DEBUG` is enabled, the optimization level is set to `-O0`.

   - **Jemalloc Compatibility**:
     - If `ENABLE_JEMALLOC` is enabled, it is automatically disabled when sanitizers are used, as they are incompatible.

   - **Environment Variables**:
     - The `ASAN_OPTIONS` environment variable is set to disable leak detection during the build phase.

4. **Build and Install Rspamd**

   After configuring, build and install Rspamd:

   ```bash
   make install
   ```

5. **Run Rspamd**

   To start the Rspamd daemon, use the following command:

   ```bash
   rspamd -f --insecure
   ```

   - `-f`: Runs Rspamd in the foreground.
   - `--insecure`: Allows running Rspamd as root (use with caution).

6. **Installation Directories**

   Rspamd will be installed in the following directories:

   - **Executables**: `/usr/local/bin`
   - **Libraries**: `/usr/local/lib`
   - **Configuration Files**: `/usr/local/etc/rspamd`
   - **Logs**: `/var/log/rspamd`

7. **Additional Options for Mac OS (ARM)**

   If you are using Mac OS on ARM architecture, you can use Homebrew to install dependencies:

   ```bash
   brew install openssl icu4c pcre2 hyperscan luajit jemalloc redis pkg-config cmake
   ```

   Then, specify the paths in the CMake command as shown in the configuration step.

## Conclusion

You have successfully built and installed Rspamd from source. If you encounter any issues, refer to the [Rspamd documentation](https://rspamd.com/doc/) for more information.
