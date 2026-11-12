import * as riveCanvasModule from "@rive-app/canvas";
import type { StateMachineInput } from "@rive-app/canvas";
import { createSignal, onCleanup, onMount } from "solid-js";
import { createLangSignal, t, type TranslationKey } from "../../i18n";

const riveCjsExports = riveCanvasModule as Record<string, unknown> & {
  default?: Record<string, unknown>;
};
const { Rive, Layout, Fit, Alignment } = (
  riveCjsExports.default?.Rive ? riveCjsExports.default : riveCjsExports
) as typeof import("@rive-app/canvas");

const rifleDesignAspectRatio = 950 / 540;

export default function Rifle1(props: { rivUrl: string }) {
  const lang = createLangSignal();
  const [canvasElement, setCanvasElement] =
    createSignal<HTMLCanvasElement | null>(null);
  const [drawWidth, setDrawWidth] = createSignal(950);
  const [loadMessage, setLoadMessage] = createSignal<string | null>(null);
  const [loadError, setLoadError] = createSignal<TranslationKey>("playground.riveLoadFailed");

  onMount(() => {
    let riveInstance: InstanceType<typeof Rive> | undefined;
    let keepShootingInput: StateMachineInput | undefined;
    let syncCheckboxToRiveInput: (() => void) | undefined;
    const keepShootingCheckbox = document.getElementById(
      "keep-shooting",
    ) as HTMLInputElement | null;

    const handleWindowResize = () => {
      setDrawWidth(Math.min(innerWidth * 0.9, 950));
      riveInstance?.resizeDrawingSurfaceToCanvas();
    };

    const { rivUrl } = props;
    if (!rivUrl) {
      setLoadError("playground.missingRiveUrl");
      setLoadMessage("error");
      return;
    }

    queueMicrotask(() => {
      const canvas = canvasElement();
      if (!canvas) {
        setLoadError("playground.canvasNotReady");
        setLoadMessage("error");
        return;
      }
      try {
        syncCheckboxToRiveInput = () => {
          if (keepShootingInput && keepShootingCheckbox) {
            keepShootingInput.value = keepShootingCheckbox.checked;
          }
        };
        riveInstance = new Rive({
          src: rivUrl,
          canvas,
          stateMachines: "rifle",
          autoplay: true,
          layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
          onLoad: () => {
            riveInstance?.resizeDrawingSurfaceToCanvas();
            setLoadMessage("");
            keepShootingInput = riveInstance
              ?.stateMachineInputs("rifle")
              ?.find(
                (input: StateMachineInput) => input.name === "keep_shooting",
              );
            if (keepShootingCheckbox && syncCheckboxToRiveInput) {
              keepShootingCheckbox.addEventListener(
                "change",
                syncCheckboxToRiveInput,
              );
            }
          },
          onLoadError: () => {
            setLoadError("playground.riveLoadFailed");
            setLoadMessage("error");
          },
        });
      } catch (error) {
        console.error("[rifle-animation]", error);
        setLoadError("playground.riveLoadFailed");
        setLoadMessage("error");
      }
    });

    window.addEventListener("resize", handleWindowResize);
    handleWindowResize();

    onCleanup(() => {
      window.removeEventListener("resize", handleWindowResize);
      if (keepShootingCheckbox && syncCheckboxToRiveInput) {
        keepShootingCheckbox.removeEventListener(
          "change",
          syncCheckboxToRiveInput,
        );
      }
      riveInstance?.stopRendering();
      riveInstance?.cleanup();
    });
  });

  return (
    <div class="flex flex-col justify-center w-fit h-fit text-white p-4">
      <h1>{t("playground.rifle", lang())}</h1>
      <p>
        Interactive animation made in rive.app using an illustration made by me
      </p>
      <p>{t("playground.rifleInstructions", lang())}</p>

      {loadMessage() === null ? (
          <p class="text-neutral-400 text-sm mb-2" aria-live="polite">
            {t("home.loadingAnimation", lang())}
        </p>
      ) : null}
      {loadMessage() && loadMessage()!.length > 0 ? (
        <p class="text-red-400 text-sm mb-2" role="alert">
          {t(loadError(), lang())}
        </p>
      ) : null}

      <div class="flex flex-col relative">
        <div class="flex gap-2 items-center justify-center absolute top-10 left-10 z-10">
          <input
            type="checkbox"
            id="keep-shooting"
            name="continuous-shooting"
          />
          <label for="keep-shooting">{t("playground.continuousShooting", lang())}</label>
        </div>
        <div
          class={loadMessage() === null ? "opacity-40 pointer-events-none" : ""}
        >
          <canvas
            ref={setCanvasElement}
            width={drawWidth()}
            height={drawWidth() / rifleDesignAspectRatio}
            style={{
              width: `${drawWidth()}px`,
              height: `${drawWidth() / rifleDesignAspectRatio}px`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
