import 'dart:io';

import 'package:dio/dio.dart';
import 'package:dio/io.dart';
import 'package:flutter/foundation.dart';

void configureLocalDevSsl(Dio dio) {
  if (!kDebugMode) {
    return;
  }

  const localHosts = {'10.0.2.2', '127.0.0.1', 'localhost'};

  dio.httpClientAdapter = IOHttpClientAdapter(
    createHttpClient: () {
      final client = HttpClient();
      client.badCertificateCallback = (cert, host, port) {
        return localHosts.contains(host);
      };
      return client;
    },
  );
}
