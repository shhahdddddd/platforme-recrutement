import 'dart:io';
import 'package:connectivity_plus/connectivity_plus.dart';

abstract class NetworkInfo {
  Future<bool> get isConnected;
}

class NetworkInfoImpl implements NetworkInfo {
  final Connectivity connectivity;
  
  NetworkInfoImpl(this.connectivity);

  @override
  Future<bool> get isConnected async {
    try {
      final connectivityResults = await connectivity.checkConnectivity();

      if (connectivityResults.contains(ConnectivityResult.none) &&
          connectivityResults.length == 1) {
        return false;
      }

      return true;
    } on SocketException catch (_) {
      return false;
    } catch (_) {
      return false;
    }
  }
}
