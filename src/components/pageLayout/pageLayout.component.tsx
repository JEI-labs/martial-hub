export const PageLayout = (props: {
  title: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="w-full">
      <h1 className="mt-8 mb-8 text-2xl font-semibold text-white">
        {props.title}
      </h1>
      <div className="mb-24 rounded-md sm:mb-16">{props.children}</div>
    </div>
  );
};
