import Image from "next/image";
import FBLogo from "@/images/AR_horiz_0.svg";
import { getTranslate } from "@/lingodotdev/server";

interface FormWrapperProps {
  children: React.ReactNode;
}

export const FormWrapper = async ({ children }: Readonly<FormWrapperProps>) => {
  const t = await getTranslate();

  return (
    <div className="mx-auto flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
      <div className="mx-auto w-full max-w-sm rounded-xl bg-white p-8 shadow-2xl lg:w-96">
        <div className="mb-8 text-center">
          <Image
            src={FBLogo}
            width={288}
            height={72}
            className="mx-auto h-auto w-3/4"
            alt={t("workspace.formbricks_logo")}
          />
        </div>
        {children}
      </div>
    </div>
  );
};
