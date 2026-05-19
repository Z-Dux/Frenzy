from docling.document_converter import DocumentConverter
from docling.datamodel.pipeline_options import PdfPipelineOptions, InputFormat

# 1. Configure the pipeline to use a VLM for better understanding
pipeline_options = PdfPipelineOptions()
pipeline_options.generate_page_images = True  # Necessary for the model to "see" the image

# 2. Setup the converter
# Note: Even for standalone images, Docling uses 'IMAGE' as the input format
converter = DocumentConverter(
    format_options={
        InputFormat.IMAGE: pipeline_options
    }
)

# 3. Process the URL
source = "https://cdn.discordapp.com/attachments/1491172665850073218/1496046097636921436/image.png?ex=69e87500&is=69e72380&hm=1a247a148126c1ccfca0b3dc9f0ec377886d1d7d00d95a0581dbdc356ca9efba"
result = converter.convert(source)

# 4. View the structured table data
print(result.document.export_to_markdown())