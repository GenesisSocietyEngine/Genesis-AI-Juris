import 'dart:convert';
import 'scenario_bridge_client.dart';

/// Uses the existing C ABI transport and its allocation/free ownership.
final class TaxAuthoringRepository {
  const TaxAuthoringRepository(this.client);
  final ScenarioBridgeClient client;

  Map<String, dynamic> execute(Map<String, dynamic> command) {
    final String encoded = jsonEncode(command);
    if (utf8.encode(encoded).length > 262144) {
      throw const TaxAuthoringException(
          'payload_too_large', 'Tax input exceeds 256 KiB.');
    }
    final dynamic value = jsonDecode(client.execute(encoded));
    if (value is! Map<String, dynamic>) {
      throw const TaxAuthoringException(
          'invalid_response', 'Invalid native response.');
    }
    if (value['type'] == 'error') {
      throw TaxAuthoringException(value['code'] as String? ?? 'native_error',
          value['message'] as String? ?? 'Native command unavailable.');
    }
    return value;
  }

  bool isSupported() {
    try {
      final Map<String, dynamic> value =
          execute({'command': 'tax_capabilities'});
      return value['type'] == 'tax_capabilities' &&
          value['transport_protocol'] == 'tax-economics-json-v1' &&
          value['input_schema'] == 'tax-economics-input-v2' &&
          value['result_schema'] == 'tax-economics-result-v2' &&
          value['application_policy'] == 'tax-editor-v1';
    } on TaxAuthoringException catch (error) {
      if (error.code == 'invalid_request') return false;
      rethrow;
    }
  }

  Map<String, dynamic> prepare(Map<String, dynamic> scenario, String artifactId,
      String revision, String currency) {
    final Map<String, dynamic> value = execute({
      'command': 'tax_prepare',
      'scenario': scenario,
      'artifact_id': artifactId,
      'revision': revision,
      'currency': currency
    });
    if (value['type'] != 'tax_prepared')
      throw TaxAuthoringException(
          'prepare_failed', jsonEncode(value['detail']));
    return value;
  }

  Map<String, dynamic> calculate(
          Map<String, dynamic> scenario,
          Map<String, dynamic> request,
          List<dynamic> bindings,
          List<dynamic> requiredIds) =>
      execute({
        'command': 'tax_calculate',
        'scenario': scenario,
        'request': request,
        'bindings': bindings,
        'required_component_ids': requiredIds,
      });
}

final class TaxAuthoringException implements Exception {
  const TaxAuthoringException(this.code, this.message);
  final String code;
  final String message;
  @override
  String toString() => '$code: $message';
}

/// Exact two-decimal conversion. No floating point and no locale guessing.
String taxCents(String amount) {
  if (!RegExp(r'^-?(0|[1-9][0-9]*)(\.[0-9]{1,2})?$').hasMatch(amount)) {
    throw const FormatException(
        'Enter an amount with at most two decimal places, using a dot.');
  }
  final bool negative = amount.startsWith('-');
  final List<String> parts =
      (negative ? amount.substring(1) : amount).split('.');
  final BigInt cents = BigInt.parse(parts[0]) * BigInt.from(100) +
      BigInt.parse(parts.length == 1 ? '0' : parts[1].padRight(2, '0'));
  if (cents > BigInt.from(100000000000000))
    throw const FormatException('Amount exceeds the supported range.');
  return (negative ? -cents : cents).toString();
}

String taxAmount(String cents) {
  final BigInt value = BigInt.parse(cents);
  final String digits = value.abs().toString().padLeft(3, '0');
  return '${value.isNegative ? '-' : ''}${digits.substring(0, digits.length - 2)}.${digits.substring(digits.length - 2)}';
}

/// Validate the editable envelope before any widget dereferences its fields.
/// Unknown/future content is retained by storage and exposed read-only.
bool validTaxArtifact(Map<String, dynamic> value) {
  try {
    if (value['schema'] != 'tax-authoring-artifact-v1' ||
        value['case_id'] is! String) return false;
    final dynamic request = value['request'], edit = value['edit'];
    if (request is! Map<String, dynamic> || edit is! Map<String, dynamic>)
      return false;
    if (request['input_schema'] != 'tax-economics-input-v2' ||
        request['transport_protocol'] != 'tax-economics-json-v1' ||
        request['application_policy'] != 'tax-editor-v1') return false;
    final dynamic context = request['context'], input = request['input'];
    if (context is! Map<String, dynamic> || input is! Map<String, dynamic>)
      return false;
    for (final String key in [
      'case_id',
      'artifact_id',
      'revision',
      'scenario_fingerprint'
    ]) {
      if (context[key] is! String) return false;
    }
    if (context['case_id'] != value['case_id'] ||
        !RegExp(r'^[0-9]+$').hasMatch(context['revision'] as String))
      return false;
    if (!['EUR', 'GBP', 'USD'].contains(input['currency']) ||
        !['amounts', 'rates'].contains(input['tax_input_basis']) ||
        !['derived', 'manual_override'].contains(input['tax_base_mode']))
      return false;
    if (input['assumptions'] is! String) return false;
    for (final String key in [
      'baseline_annual_tax_cost',
      'optimized_annual_tax_cost',
      'implementation_cost',
      'annual_maintenance_cost',
      'terminal_tax_or_unwind_cost',
      'annual_tax_base_override',
      'baseline_tax_rate_bps',
      'optimized_tax_rate_bps',
      'analysis_horizon_months',
      'annual_discount_rate_bps',
      'benefit_realization_bps'
    ]) {
      if (edit[key] is! String) return false;
    }
    for (final String key in [
      'override_reason',
      'override_owner',
      'override_as_of'
    ]) {
      if (input[key] != null && input[key] is! String) return false;
    }
    if (value['bindings'] is! List ||
        value['benefits'] is! List ||
        value['required_component_ids'] is! List) return false;
    if ((value['required_component_ids'] as List<dynamic>)
        .any((dynamic v) => v is! String)) return false;
    for (final dynamic b in value['bindings'] as List<dynamic>) {
      if (b is! Map<String, dynamic>) return false;
      for (final String key in [
        'component_id',
        'label',
        'category',
        'amount_text',
        'currency',
        'fact_id',
        'source_field',
        'scenario_fingerprint',
        'note'
      ]) {
        if (b[key] is! String) return false;
      }
      for (final String key in [
        'period',
        'jurisdiction',
        'confirmation_owner',
        'confirmation_as_of'
      ]) {
        if (b[key] != null && b[key] is! String) return false;
      }
      if (b['confirmed'] is! bool || b['include_in_calculation'] is! bool)
        return false;
      if (![
        'taxable_income',
        'deductible_expense',
        'non_deductible_addback',
        'exempt_income',
        'tax_loss_utilized',
        'taxable_adjustment',
        'deductible_adjustment'
      ].contains(b['category'])) return false;
    }
    for (final dynamic b in value['benefits'] as List<dynamic>) {
      if (b is! Map<String, dynamic>) return false;
      for (final String key in [
        'id',
        'label',
        'amount_text',
        'start_month',
        'end_month',
        'timing'
      ]) {
        if (b[key] is! String) return false;
      }
      if (!['recurring_annual', 'one_off'].contains(b['timing']) ||
          b['include_in_base_case'] is! bool) return false;
    }
    final dynamic revision = value['artifact_revision'];
    if (revision != null &&
        (revision is! String || !RegExp(r'^[0-9]+$').hasMatch(revision)))
      return false;
    return true;
  } on Object {
    return false;
  }
}
