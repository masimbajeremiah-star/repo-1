package com.pakapoker.game16;

import androidx.annotation.NonNull;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@CapacitorPlugin(name = "GooglePlayBilling")
public class GooglePlayBillingPlugin extends Plugin {
    private BillingClient billingClient;
    private PluginCall purchaseCall;

    @Override
    public void load() {
        billingClient = BillingClient.newBuilder(getContext())
            .setListener((result, purchases) -> {
                if (purchaseCall == null) return;
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || purchases == null || purchases.isEmpty()) {
                    purchaseCall.reject(result.getDebugMessage().isEmpty() ? "Google Play purchase was not completed." : result.getDebugMessage());
                } else {
                    purchaseCall.resolve(toPurchase(purchases.get(0)));
                }
                purchaseCall = null;
            })
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .build();
    }

    private void withConnected(PluginCall call, Runnable action) {
        if (billingClient.isReady()) { action.run(); return; }
        billingClient.startConnection(new BillingClientStateListener() {
            @Override public void onBillingServiceDisconnected() {}
            @Override public void onBillingSetupFinished(@NonNull BillingResult result) {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) action.run();
                else call.reject("Google Play Billing unavailable: " + result.getDebugMessage());
            }
        });
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        String productId = call.getString("productId", "");
        if (productId.isEmpty()) { call.reject("A Google Play product ID is required."); return; }
        withConnected(call, () -> {
            QueryProductDetailsParams.Product product = QueryProductDetailsParams.Product.newBuilder()
                .setProductId(productId).setProductType(BillingClient.ProductType.SUBS).build();
            QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder().setProductList(Collections.singletonList(product)).build();
            billingClient.queryProductDetailsAsync(params, (result, detailsResult) -> {
                List<ProductDetails> details = detailsResult.getProductDetailsList();
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || details.isEmpty()) {
                    call.reject("PAKA Plus is not available from Google Play for this account."); return;
                }
                ProductDetails selected = details.get(0);
                List<ProductDetails.SubscriptionOfferDetails> offers = selected.getSubscriptionOfferDetails();
                if (offers == null || offers.isEmpty()) { call.reject("The PAKA Plus base plan is not active in Google Play."); return; }
                ProductDetails.SubscriptionOfferDetails offer = offers.get(0);
                for (ProductDetails.SubscriptionOfferDetails candidate : offers) {
                    boolean hasFreePhase = candidate.getPricingPhases().getPricingPhaseList().stream().anyMatch(phase -> phase.getPriceAmountMicros() == 0);
                    if (hasFreePhase) { offer = candidate; break; }
                }
                BillingFlowParams.ProductDetailsParams productParams = BillingFlowParams.ProductDetailsParams.newBuilder()
                    .setProductDetails(selected).setOfferToken(offer.getOfferToken()).build();
                BillingFlowParams.Builder flow = BillingFlowParams.newBuilder().setProductDetailsParamsList(Collections.singletonList(productParams));
                String accountId = call.getString("obfuscatedAccountId", "");
                if (!accountId.isEmpty()) flow.setObfuscatedAccountId(accountId);
                purchaseCall = call;
                BillingResult launch = billingClient.launchBillingFlow(getActivity(), flow.build());
                if (launch.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    purchaseCall = null;
                    call.reject("Unable to open Google Play: " + launch.getDebugMessage());
                }
            });
        });
    }

    @PluginMethod
    public void restorePurchases(PluginCall call) {
        withConnected(call, () -> billingClient.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(),
            (result, purchases) -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) { call.reject(result.getDebugMessage()); return; }
                JSArray output = new JSArray();
                for (com.android.billingclient.api.Purchase purchase : purchases) output.put(toPurchase(purchase));
                JSObject response = new JSObject(); response.put("purchases", output); call.resolve(response);
            }
        ));
    }

    private JSObject toPurchase(com.android.billingclient.api.Purchase purchase) {
        JSObject value = new JSObject();
        value.put("productId", purchase.getProducts().isEmpty() ? "" : purchase.getProducts().get(0));
        value.put("purchaseToken", purchase.getPurchaseToken());
        value.put("packageName", getContext().getPackageName());
        return value;
    }

    @Override
    protected void handleOnDestroy() {
        if (billingClient != null) billingClient.endConnection();
    }
}
