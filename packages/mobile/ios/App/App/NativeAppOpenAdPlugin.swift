import Capacitor
import Foundation
import GoogleMobileAds
import UIKit

@objc(NativeAppOpenAdPlugin)
public class NativeAppOpenAdPlugin: CAPPlugin, CAPBridgedPlugin, FullScreenContentDelegate {
    public let identifier = "NativeAppOpenAdPlugin"
    public let jsName = "NativeAppOpenAd"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "load", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isLoaded", returnType: CAPPluginReturnPromise)
    ]

    private static let maximumAdAge: TimeInterval = 4 * 60 * 60
    private var appOpenAd: AppOpenAd?
    private var loadedAt: Date?
    private var isLoading = false
    private var isShowing = false
    private var showCall: CAPPluginCall?

    @objc public func load(_ call: CAPPluginCall) {
        guard let adId = call.getString("adId"), !adId.isEmpty else {
            call.reject("adId is required")
            return
        }

        if hasFreshAd {
            call.resolve()
            return
        }
        clearExpiredAd()

        guard !isLoading else {
            call.reject("An App Open ad is already loading")
            return
        }

        isLoading = true
        Task { [weak self] in
            guard let self else { return }
            do {
                let ad = try await AppOpenAd.load(with: adId, request: Request())
                await MainActor.run {
                    self.appOpenAd = ad
                    self.loadedAt = Date()
                    self.isLoading = false
                    call.resolve()
                }
            } catch {
                await MainActor.run {
                    self.clearAd()
                    self.isLoading = false
                    call.reject(error.localizedDescription)
                }
            }
        }
    }

    @objc public func isLoaded(_ call: CAPPluginCall) {
        clearExpiredAd()
        call.resolve(["value": hasFreshAd])
    }

    @objc public func show(_ call: CAPPluginCall) {
        clearExpiredAd()
        guard let appOpenAd, hasFreshAd, !isShowing else {
            call.reject("App Open ad is not ready")
            return
        }
        guard let viewController = bridge?.viewController else {
            call.reject("No root view controller")
            return
        }

        isShowing = true
        showCall = call
        appOpenAd.fullScreenContentDelegate = self
        appOpenAd.present(from: viewController)
    }

    public func adWillPresentFullScreenContent(_ ad: FullScreenPresentingAd) {
        notifyListeners("nativeAppOpenAdShown", data: [:])
    }

    public func adDidDismissFullScreenContent(_ ad: FullScreenPresentingAd) {
        let call = showCall
        clearAd()
        notifyListeners("nativeAppOpenAdDismissed", data: [:])
        call?.resolve()
    }

    public func ad(
        _ ad: FullScreenPresentingAd,
        didFailToPresentFullScreenContentWithError error: Error
    ) {
        let call = showCall
        let errorCode = (error as NSError).code
        clearAd()
        notifyListeners("nativeAppOpenAdFailedToShow", data: ["code": errorCode])
        call?.reject(error.localizedDescription)
    }

    private var hasFreshAd: Bool {
        guard appOpenAd != nil, let loadedAt else { return false }
        return Date().timeIntervalSince(loadedAt) < Self.maximumAdAge
    }

    private func clearExpiredAd() {
        if !hasFreshAd {
            clearAd()
        }
    }

    private func clearAd() {
        appOpenAd = nil
        loadedAt = nil
        isShowing = false
        showCall = nil
    }
}

@objc(BridgeViewController)
public class BridgeViewController: CAPBridgeViewController {
    public override func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativeAppOpenAdPlugin())
    }
}
