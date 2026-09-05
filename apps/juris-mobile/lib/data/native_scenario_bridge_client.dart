import 'dart:ffi';
import 'dart:io';

import 'package:ffi/ffi.dart';

import 'scenario_bridge_client.dart';

typedef _NativeExecute = Pointer<Utf8> Function(Pointer<Utf8> request);
typedef _DartExecute = Pointer<Utf8> Function(Pointer<Utf8> request);
typedef _NativeFree = Void Function(Pointer<Utf8> response);
typedef _DartFree = void Function(Pointer<Utf8> response);
typedef _NativeAbiVersion = Uint32 Function();
typedef _DartAbiVersion = int Function();

/// Dart FFI transport shared by Android and iOS.
///
/// Android packages `libjuris_mobile_ffi.so` per ABI and loads it by name.
/// iOS links the Rust static library into Runner and resolves its exported
/// symbols from the current process.
final class NativeScenarioBridgeClient implements ScenarioBridgeClient {
  NativeScenarioBridgeClient({DynamicLibrary? library})
      : _library = library ?? _openLibrary() {
    _execute = _library.lookupFunction<_NativeExecute, _DartExecute>(
      'juris_mobile_bridge_execute',
    );
    _free = _library.lookupFunction<_NativeFree, _DartFree>(
      'juris_mobile_bridge_string_free',
    );
    final _DartAbiVersion abiVersion =
        _library.lookupFunction<_NativeAbiVersion, _DartAbiVersion>(
      'juris_mobile_bridge_abi_version',
    );
    if (abiVersion() != 1) {
      throw StateError('Unsupported native scenario bridge ABI');
    }
  }

  final DynamicLibrary _library;
  late final _DartExecute _execute;
  late final _DartFree _free;

  @override
  String execute(String encodedRequest) {
    final Pointer<Utf8> request = encodedRequest.toNativeUtf8();
    Pointer<Utf8> response = nullptr.cast<Utf8>();
    try {
      response = _execute(request);
      if (response == nullptr) {
        throw StateError('Native scenario bridge returned a null response');
      }
      return response.toDartString();
    } finally {
      malloc.free(request);
      if (response != nullptr) {
        _free(response);
      }
    }
  }

  static DynamicLibrary _openLibrary() {
    if (Platform.isAndroid) {
      return DynamicLibrary.open('libjuris_mobile_ffi.so');
    }
    if (Platform.isIOS) {
      return DynamicLibrary.process();
    }
    if (Platform.isWindows) {
      return DynamicLibrary.open('juris_mobile_ffi.dll');
    }
    if (Platform.isMacOS) {
      return DynamicLibrary.open('libjuris_mobile_ffi.dylib');
    }
    if (Platform.isLinux) {
      return DynamicLibrary.open('libjuris_mobile_ffi.so');
    }
    throw UnsupportedError(
      'Native scenario bridge is unavailable on ${Platform.operatingSystem}',
    );
  }
}
