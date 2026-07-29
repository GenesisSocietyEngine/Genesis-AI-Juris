import Foundation
import Flutter
import UIKit
import XCTest

@_silgen_name("juris_mobile_bridge_execute")
private func jurisMobileBridgeExecute(
  _ request: UnsafePointer<CChar>
) -> UnsafeMutablePointer<CChar>?

@_silgen_name("juris_mobile_bridge_string_free")
private func jurisMobileBridgeStringFree(
  _ response: UnsafeMutablePointer<CChar>?
)

@_silgen_name("juris_mobile_bridge_abi_version")
private func jurisMobileBridgeAbiVersion() -> UInt32

class RunnerTests: XCTestCase {

  private func executeBridge(
    _ request: [String: Any]
  ) throws -> [String: Any] {
    let requestData = try JSONSerialization.data(withJSONObject: request)
    let requestJSON = try XCTUnwrap(
      String(data: requestData, encoding: .utf8)
    )
    let responsePointer = try XCTUnwrap(
      requestJSON.withCString { jurisMobileBridgeExecute($0) }
    )
    defer {
      jurisMobileBridgeStringFree(responsePointer)
    }

    let responseData = Data(String(cString: responsePointer).utf8)
    return try XCTUnwrap(
      JSONSerialization.jsonObject(with: responseData) as? [String: Any]
    )
  }

  func testNativeLogisticsLifecycle() throws {
    XCTAssertEqual(jurisMobileBridgeAbiVersion(), 1)

    let bundleURL = Bundle.main.bundleURL
      .appendingPathComponent("Frameworks")
      .appendingPathComponent("App.framework")
      .appendingPathComponent("flutter_assets")
      .appendingPathComponent("assets")
      .appendingPathComponent("case_catalog")
      .appendingPathComponent("mobile_case_bundle.json")
    let bundleData = try Data(contentsOf: bundleURL)
    let bundle = try XCTUnwrap(
      JSONSerialization.jsonObject(with: bundleData) as? [String: Any]
    )
    let cases = try XCTUnwrap(bundle["cases"] as? [[String: Any]])
    let logistics = try XCTUnwrap(
      cases.first {
        $0["case_id"] as? String == "be_commercial_logistics_001"
      }
    )
    let scenario = try XCTUnwrap(
      logistics["scenario"] as? [String: Any]
    )
    let seed = try XCTUnwrap(logistics["seed"] as? NSNumber)

    let created = try executeBridge([
      "command": "create_session",
      "scenario": scenario,
      "seed": seed,
    ])
    XCTAssertEqual(created["type"] as? String, "session_created")
    XCTAssertEqual(
      (created["snapshot"] as? [String: Any])?["stage_id"] as? String,
      "intake"
    )
    let sessionID = try XCTUnwrap(created["session_id"] as? NSNumber)

    let dispatched = try executeBridge([
      "command": "dispatch",
      "session_id": sessionID,
      "action_id": "audit_claim_file",
    ])
    XCTAssertEqual(dispatched["type"] as? String, "snapshot")
    XCTAssertEqual(
      (dispatched["snapshot"] as? [String: Any])?["stage_id"] as? String,
      "pre_action"
    )
    let dispatchedClock = try XCTUnwrap(
      (dispatched["snapshot"] as? [String: Any])?["clock_minutes"]
        as? NSNumber
    )
    XCTAssertEqual(dispatchedClock.intValue, 120)

    let snapshot = try executeBridge([
      "command": "snapshot",
      "session_id": sessionID,
    ])
    XCTAssertEqual(snapshot["type"] as? String, "snapshot")
    XCTAssertEqual(
      (snapshot["snapshot"] as? [String: Any])?["stage_id"] as? String,
      "pre_action"
    )

    let disposed = try executeBridge([
      "command": "dispose_session",
      "session_id": sessionID,
    ])
    XCTAssertEqual(disposed["type"] as? String, "session_disposed")
    XCTAssertEqual(disposed["disposed"] as? Bool, true)

    let disposedAgain = try executeBridge([
      "command": "dispose_session",
      "session_id": sessionID,
    ])
    XCTAssertEqual(disposedAgain["type"] as? String, "session_disposed")
    XCTAssertEqual(disposedAgain["disposed"] as? Bool, false)

    let invalidHandle = try executeBridge([
      "command": "snapshot",
      "session_id": sessionID,
    ])
    XCTAssertEqual(invalidHandle["type"] as? String, "error")
    XCTAssertEqual(invalidHandle["code"] as? String, "unknown_session")
  }

}
